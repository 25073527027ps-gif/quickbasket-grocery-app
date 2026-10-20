
import { NextRequest, NextResponse } from "next/server";
import {
  readDeliverySession,
  responseMessage,
  supabaseRequest,
} from "@/lib/delivery-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = readDeliverySession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please login again." },
        { status: 401 }
      );
    }

    const query = new URLSearchParams({
      select:
        "id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,delivery_notes",
      assigned_partner_id: `eq.${session.partnerId}`,
      order: "created_at.desc",
    });

    const response = await supabaseRequest(
      `orders?${query.toString()}`
    );

    if (!response.ok) {
      const message = await responseMessage(response);

      return NextResponse.json(
        {
          success: false,
          message: message || "Orders load nahi hue.",
        },
        { status: 502 }
      );
    }

    const orders = await response.json();

    return NextResponse.json({
      success: true,
      orders: Array.isArray(orders) ? orders : [],
    });
  } catch (error) {
    console.error("Delivery partner orders error:", error);

    return NextResponse.json(
      { success: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
