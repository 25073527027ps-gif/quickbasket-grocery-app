
import { NextResponse } from "next/server";
import {
  deliveryCookieOptions,
} from "../../../../lib/delivery-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.cookies.set("qb_delivery_session", "", {
    ...deliveryCookieOptions(),
    maxAge: 0,
  });

  return response;
}
