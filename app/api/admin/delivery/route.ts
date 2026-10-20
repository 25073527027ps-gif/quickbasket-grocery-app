
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const ADMIN_KEY = process.env.DELIVERY_ADMIN_KEY;

const allowedStatuses = [
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof allowedStatuses)[number];

function jsonError(message: string, status: number, details?: string) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

function authorized(request: Request) {
  const key = request.headers.get("x-delivery-admin-key");
  return Boolean(ADMIN_KEY && key && key === ADMIN_KEY);
}

async function db(path: string, options: RequestInit = {}) {
  if (!URL || !SECRET) {
    throw new Error("Supabase environment variables are missing.");
  }

  return fetch(`${URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
}

async function responseError(response: Response) {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return data.message || data.details || data.hint || text;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return jsonError("Unauthorized. Check the admin key.", 401);
  }

  try {
    const [ordersRes, partnersRes] = await Promise.all([
      db(
        "orders?select=id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,assigned_partner_id,assigned_at&order=created_at.desc&limit=100"
      ),
      db(
        "delivery_partners?select=id,full_name,phone,is_active&order=created_at.desc"
      ),
    ]);

    if (!ordersRes.ok) {
      return jsonError(
        "Could not load orders.",
        502,
        await responseError(ordersRes)
      );
    }

    if (!partnersRes.ok) {
      return jsonError(
        "Could not load delivery partners.",
        502,
        await responseError(partnersRes)
      );
    }

    const [orders, partners] = await Promise.all([
      ordersRes.json(),
      partnersRes.json(),
    ]);

    return NextResponse.json({ orders, partners });
  } catch (error) {
    return jsonError(
      "Delivery service unavailable.",
      503,
      error instanceof Error ? error.message : "Unknown server error."
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return jsonError("Unauthorized. Check the admin key.", 401);
  }

  try {
    const body = await request.json();

    if (body.action === "add_partner") {
      const fullName =
        typeof body.fullName === "string" ? body.fullName.trim() : "";
      const phone =
        typeof body.phone === "string" ? body.phone.trim() : "";

      if (
        fullName.length < 2 ||
        fullName.length > 100 ||
        !/^[6-9]\d{9}$/.test(phone)
      ) {
        return jsonError(
          "Enter a name and valid 10-digit mobile number.",
          400
        );
      }

      const response = await db("delivery_partners", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          is_active: true,
        }),
      });

      if (!response.ok) {
        return jsonError(
          "Partner could not be added.",
          502,
          await responseError(response)
        );
      }

      const rows = await response.json();
      return NextResponse.json({ partner: rows[0] }, { status: 201 });
    }

    if (body.action === "assign_order") {
      const orderId =
        typeof body.orderId === "string" ? body.orderId : "";
      const partnerId =
        typeof body.partnerId === "string" ? body.partnerId : "";

      if (!uuidPattern.test(orderId) || !uuidPattern.test(partnerId)) {
        return jsonError("Select a valid order and partner.", 400);
      }

      const partnerRes = await db(
        `delivery_partners?id=eq.${partnerId}&is_active=eq.true&select=id`
      );

      if (!partnerRes.ok) {
        return jsonError(
          "Could not verify delivery partner.",
          502,
          await responseError(partnerRes)
        );
      }

      const partners = await partnerRes.json();

      if (!partners.length) {
        return jsonError("Active delivery partner not found.", 400);
      }

      const response = await db(
        `orders?id=eq.${orderId}&select=id,order_number,assigned_partner_id,assigned_at`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            assigned_partner_id: partnerId,
            assigned_at: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        return jsonError(
          "Order assignment failed.",
          502,
          await responseError(response)
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return jsonError("Order not found.", 404);
      }

      return NextResponse.json({ order: rows[0] });
    }

    if (body.action === "update_order_status") {
      const orderId =
        typeof body.orderId === "string" ? body.orderId : "";
      const status =
        typeof body.status === "string" ? body.status.trim() : "";

      if (!uuidPattern.test(orderId)) {
        return jsonError("Invalid order ID.", 400);
      }

      if (
        !allowedStatuses.includes(status as OrderStatus)
      ) {
        return jsonError(
          `Invalid status: ${status}.`,
          400
        );
      }

      const response = await db(
        `orders?id=eq.${orderId}&select=id,order_number,order_status`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ order_status: status }),
        }
      );

      if (!response.ok) {
        return jsonError(
          `Could not update order status to "${status}".`,
          502,
          await responseError(response)
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return jsonError(
          "Order not found or no row was updated.",
          404
        );
      }

      return NextResponse.json({
        success: true,
        message: `Order status updated to ${rows[0].order_status}.`,
        order: rows[0],
      });
    }

    return jsonError("Unknown action.", 400);
  } catch (error) {
    return jsonError(
      "Request failed.",
      500,
      error instanceof Error ? error.message : "Unknown server error."
    );
  }
}
