
import { NextRequest, NextResponse } from "next/server";
import {
  readDeliverySession,
  supabaseRequest,
  responseMessage,
} from "@/lib/delivery-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTransitions: Record<string, string[]> = {
  placed: ["preparing"],
  preparing: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

export async function POST(request: NextRequest) {
  const session = readDeliverySession(request);

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Please log in again." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const orderId = String(body.orderId ?? "");
    const newStatus = String(body.status ?? "");

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json(
        { success: false, message: "Invalid order ID." },
        { status: 400 }
      );
    }

    if (!Object.values(allowedTransitions).some((s) => s.includes(newStatus))) {
      return NextResponse.json(
        { success: false, message: "Invalid order status." },
        { status: 400 }
      );
    }

    const check = await supabaseRequest(
      `orders?id=eq.${orderId}&assigned_partner_id=eq.${session.partnerId}&select=id,order_status`
    );

    if (!check.ok) {
      return NextResponse.json(
        { success: false, message: await responseMessage(check) },
        { status: 502 }
      );
    }

    const rows = await check.json();
    const order = rows[0];

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found or not assigned to you." },
        { status: 404 }
      );
    }

    if (!(allowedTransitions[order.order_status] ?? []).includes(newStatus)) {
      return NextResponse.json(
        { success: false, message: "This status change is not allowed." },
        { status: 400 }
      );
    }

    const update = await supabaseRequest(
      `orders?id=eq.${orderId}&assigned_partner_id=eq.${session.partnerId}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ order_status: newStatus }),
      }
    );

    if (!update.ok) {
      return NextResponse.json(
        { success: false, message: await responseMessage(update) },
        { status: 502 }
      );
    }

    const updated = await update.json();

    if (!updated.length) {
      return NextResponse.json(
        { success: false, message: "Order status was not updated." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updated[0],
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to update order status." },
      { status: 500 }
    );
  }
}

