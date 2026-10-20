
import { NextRequest, NextResponse } from "next/server";
import {
  readDeliverySession,
  responseMessage,
  supabaseRequest,
} from "@/lib/delivery-auth";

export async function GET(request: NextRequest) {
  try {
    const session = readDeliverySession(request);

    if (!session) {
      return NextResponse.json(
        { message: "Please login again." },
        { status: 401 }
      );
    }

    const query = new URLSearchParams({
      select:
        "id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,delivery_notes",
      delivery_partner_id: `eq.${session.partnerId}`,
      order: "created_at.desc",
    });

    const response = await supabaseRequest(
      `orders?${query.toString()}`
    );

    if (!response.ok) {
      const message = await responseMessage(response);

      return NextResponse.json(
        { message: message || "Orders load nahi hue." },
        { status: 500 }
      );
    }

    const orders = await response.json();

    return NextResponse.json({ orders });
  } catch {
    return NextResponse.json(
      { message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}
