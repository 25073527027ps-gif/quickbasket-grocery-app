
import { NextRequest, NextResponse } from "next/server";
import {
  readDeliverySession,
  supabaseRequest,
  responseMessage,
} from "@/lib/delivery-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = readDeliverySession(request);

  if (!session) {
    return NextResponse.json(
      { success: false, message: "Please log in again." },
      { status: 401 }
    );
  }

  try {
    const query = new URLSearchParams({
      assigned_partner_id: `eq.${session.partnerId}`,
      select:
        "id,order_number,customer_name,customer_phone,delivery_address,order_status,total,created_at,delivery_notes",
      order: "created_at.desc",
    });

    const response = await supabaseRequest(`orders?${query.toString()}`);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: await responseMessage(response),
        },
        { status: 502 }
      );
    }

    const orders = await response.json();

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to load orders." },
      { status: 500 }
    );
  }
}
