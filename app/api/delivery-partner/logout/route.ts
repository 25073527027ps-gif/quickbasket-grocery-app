
import { NextResponse } from "next/server";
import {
  deliveryCookieOptions,
  COOKIE_NAME,
} from "@/lib/delivery-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.cookies.set(COOKIE_NAME, "", {
    ...deliveryCookieOptions(),
    maxAge: 0,
  });

  return response;
}
