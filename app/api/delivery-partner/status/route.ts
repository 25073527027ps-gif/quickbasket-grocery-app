
import { NextRequest, NextResponse } from "next/server";
import {
  readDeliverySession,
  responseMessage,
  supabaseRequest,
} from "../../../../lib/delivery-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = [
  "preparing",
  "out_for_delivery",
  "delivered",
];

export async function PATCH(request: NextRequest) {
  try {
    const session = readDeliverySession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please login again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const orderId = String(body.orderId || "").trim();
    const status = String(body.status || "").trim();

    if (!orderId || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid order ID or status." },
        { status: 400 }
      );
    }

    const query = new URLSearchParams({
      select: "id,assigned_partner_id",
      id: `eq.${orderId}`,
      assigned_partner_id: `eq.${session.partnerId}`,
    });

    const check = await supabaseRequest(`orders?${query.toString()}`);

    if (!check.ok) {
      return NextResponse.json(
        { success: false, message: await responseMessage(check) },
        { status: 502 }
      );
    }

    const orders = await check.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found for this partner.",
        },
        { status: 404 }
      );
    }

    const updateQuery = new URLSearchParams({
      id: `eq.${orderId}`,
      assigned_partner_id: `eq.${session.partnerId}`,
    });

    const update = await supabaseRequest(
      `orders?${updateQuery.toString()}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ order_status: status }),
      }
    );

    if (!update.ok) {
      return NextResponse.json(
        { success: false, message: await responseMessage(update) },
        { status: 502 }
      );
    }

    const updatedOrders = await update.json();

    if (!Array.isArray(updatedOrders) || updatedOrders.length === 0) {
      return NextResponse.json(
        { success: false, message: "Order status was not updated." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order status updated.",
      order: updatedOrders[0],
    });
  } catch (error) {
    console.error("Delivery partner status error:", error);

    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
