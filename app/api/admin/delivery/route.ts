
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const ADMIN_KEY = process.env.DELIVERY_ADMIN_KEY;

function authorized(request: Request) {
  const key = request.headers.get("x-delivery-admin-key");
  return Boolean(ADMIN_KEY && key && key === ADMIN_KEY);
}

async function db(path: string, options: RequestInit = {}) {
  if (!URL || !SECRET) {
    throw new Error("Supabase is not configured.");
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

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [ordersRes, partnersRes] = await Promise.all([
      db("orders?select=id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,assigned_partner_id,assigned_at&order=created_at.desc&limit=100"),
      db("delivery_partners?select=id,full_name,phone,is_active&order=created_at.desc"),
    ]);

    if (!ordersRes.ok || !partnersRes.ok) {
      return NextResponse.json(
        { error: "Could not load delivery data." },
        { status: 502 }
      );
    }

    const [orders, partners] = await Promise.all([
      ordersRes.json(),
      partnersRes.json(),
    ]);

    return NextResponse.json({ orders, partners });
  } catch {
    return NextResponse.json(
      { error: "Delivery service unavailable." },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        return NextResponse.json(
          { error: "Enter a name and valid 10-digit mobile number." },
          { status: 400 }
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
        return NextResponse.json(
          { error: "Partner could not be added. Check if the phone already exists." },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { partner: (await response.json())[0] },
        { status: 201 }
      );
    }

    if (body.action === "assign_order") {
      const orderId =
        typeof body.orderId === "string" ? body.orderId : "";
      const partnerId =
        typeof body.partnerId === "string" ? body.partnerId : "";

      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuid.test(orderId) || !uuid.test(partnerId)) {
        return NextResponse.json(
          { error: "Select a valid order and partner." },
          { status: 400 }
        );
      }

      const partnerRes = await db(
        `delivery_partners?id=eq.${partnerId}&is_active=eq.true&select=id`
      );

      if (!partnerRes.ok || (await partnerRes.json()).length === 0) {
        return NextResponse.json(
          { error: "Active delivery partner not found." },
          { status: 400 }
        );
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
        return NextResponse.json(
          { error: "Order assignment failed." },
          { status: 502 }
        );
      }

      const rows = await response.json();

      if (!rows.length) {
        return NextResponse.json(
          { error: "Order not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({ order: rows[0] });
    }

    return NextResponse.json(
      { error: "Unknown action." },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request or database error." },
      { status: 400 }
    );
  }
}

