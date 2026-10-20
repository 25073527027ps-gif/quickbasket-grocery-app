
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Delivery partner authentication is not configured yet.",
      orders: [],
    },
    { status: 401 }
  );
}

