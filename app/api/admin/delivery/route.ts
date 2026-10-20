import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_KEY = process.env.DELIVERY_ADMIN_KEY;

const allowedStatuses = [
  "placed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof allowedStatuses)[number];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorJson(message: string, status: number, details?: string) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

function authorized(request: Request) {
  const supplied = request.headers.get("x-delivery-admin-key");
  return Boolean(ADMIN_KEY && supplied && supplied === ADMIN_KEY);
}

async function db(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
}

async function responseMessage(response: Response) {
  const raw = await response.text();

  try {
    const data = JSON.parse(raw);
    return data.message || data.details || data.hint || raw;
  } catch {
    return raw || `HTTP ${response.status}`;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return errorJson("Unauthorized. Check the admin key.", 401);
  }

  try {
    const [ordersResponse, partnersResponse] = await Promise.all([
      db(
        "orders?select=id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,assigned_partner_id,assigned_at&order=created_at.desc&limit=100"
      ),
      db(
        "delivery_partners?select=id,full_name,phone,is_active,created_at&order=created_at.desc"
      ),
    ]);

    if (!ordersResponse.ok) {
      return errorJson(
        "Could not load orders.",
        502,
        await responseMessage(ordersResponse)
      );
    }

    if (!partnersResponse.ok) {
      return errorJson(
        "Could not load delivery partners.",
        502,
        await responseMessage(partnersResponse)
      );
    }

    const [orders, partners] = await Promise.all([
      ordersResponse.json(),
      partnersResponse.json(),
    ]);

    return NextResponse.json({ orders, partners });
  } catch (error) {
    return errorJson(
      "Delivery service unavailable.",
      503,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return errorJson("Unauthorized. Check the admin key.", 401);
  }

  try {
    const body = await request.json();

    // Add a new delivery partner
    if (body.action === "add_partner") {
      const fullName =
        typeof body.fullName === "string" ? body.fullName.trim() : "";
      const phone =
        typeof body.phone === "string"
          ? body.phone.replace(/\D/g, "")
          : "";

      if (
        fullName.length < 2 ||
        fullName.length > 100 ||
        !/^[6-9]\d{9}$/.test(phone)
      ) {
        return errorJson(
          "Enter a name and valid 10-digit Indian mobile number.",
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
        return errorJson(
          "Partner could not be added.",
          502,
          await responseMessage(response)
        );
      }

      const rows = await response.json();
      return NextResponse.json({ partner: rows[0] }, { status: 201 });
    }

    // Set or reset a partner's six-digit PIN
    if (body.action === "set_partner_pin") {
      const partnerId =
        typeof body.partnerId === "string" ? body.partnerId : "";
      const pin = typeof body.pin === "string" ? body.pin : "";

      if (!uuidPattern.test(partnerId) || !/^\d{6}$/.test(pin)) {
        return errorJson(
          "Select a valid partner and enter a 6-digit PIN.",
          400
        );
      }

      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(pin, salt, 64).toString("hex");

      const response = await db(
        `delivery_partners?id=eq.${partnerId}&select=id,full_name,phone,is_active`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ pin_hash: `${salt}:${hash}` }),
        }
      );

      if (!response.ok) {
        return errorJson(
          "Could not save partner PIN. Check that pin_hash exists.",
          502,
          await responseMessage(response)
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return errorJson("Delivery partner not found.", 404);
      }

      return NextResponse.json({
        success: true,
        message: "PIN saved. Share it privately with the partner.",
        partner: rows[0],
      });
    }

    // Assign an order to a delivery partner
    if (body.action === "assign_order") {
      const orderId =
        typeof body.orderId === "string" ? body.orderId : "";
      const partnerId =
        typeof body.partnerId === "string" ? body.partnerId : "";

      if (!uuidPattern.test(orderId) || !uuidPattern.test(partnerId)) {
        return errorJson("Select a valid order and partner.", 400);
      }

      const partnerResponse = await db(
        `delivery_partners?id=eq.${partnerId}&is_active=eq.true&select=id`
      );

      if (!partnerResponse.ok) {
        return errorJson(
          "Could not verify delivery partner.",
          502,
          await responseMessage(partnerResponse)
        );
      }

      const partners = await partnerResponse.json();

      if (!partners.length) {
        return errorJson("Active delivery partner not found.", 400);
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
        return errorJson(
          "Order assignment failed.",
          502,
          await responseMessage(response)
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return errorJson("Order not found.", 404);
      }

      return NextResponse.json({ order: rows[0] });
    }

    // Admin can update an order status
    if (body.action === "update_order_status") {
      const orderId =
        typeof body.orderId === "string" ? body.orderId : "";
      const status =
        typeof body.status === "string" ? body.status : "";

      if (!uuidPattern.test(orderId)) {
        return errorJson("Invalid order ID.", 400);
      }

      if (!allowedStatuses.includes(status as OrderStatus)) {
        return errorJson("Invalid order status.", 400);
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
        return errorJson(
          "Could not update order status.",
          502,
          await responseMessage(response)
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return errorJson("Order not found or not updated.", 404);
      }

      return NextResponse.json({
        success: true,
        order: rows[0],
      });
    }

    return errorJson("Unknown action.", 400);
  } catch (error) {
    return errorJson(
      "Request failed.",
      500,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
