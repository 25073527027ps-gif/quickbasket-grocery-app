
import { NextRequest, NextResponse } from "next/server";
import {
  createDeliverySession,
  deliveryCookieOptions,
  supabaseRequest,
  responseMessage,
  COOKIE_NAME,
} from "../../../../lib/delivery-auth";
import { scryptSync, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    const pin = String(body.pin ?? "");

    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid mobile number and 6-digit PIN." },
        { status: 400 }
      );
    }

    const query = new URLSearchParams({
      phone: `eq.${phone}`,
      is_active: "eq.true",
      select: "id,phone,full_name,pin_hash",
      limit: "1",
    });

    const result = await supabaseRequest(
      `delivery_partners?${query.toString()}`
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: await responseMessage(result) },
        { status: 502 }
      );
    }

    const partners = await result.json();
    const partner = Array.isArray(partners) ? partners[0] : null;

    if (!partner?.pin_hash || typeof partner.pin_hash !== "string") {
      return NextResponse.json(
        { success: false, message: "Invalid mobile number or PIN." },
        { status: 401 }
      );
    }

    const [salt, storedHash] = partner.pin_hash.split(":");

    if (!salt || !storedHash || !/^[a-f0-9]{128}$/i.test(storedHash)) {
      return NextResponse.json(
        { success: false, message: "PIN setup is incomplete. Contact admin." },
        { status: 401 }
      );
    }

    const calculated = scryptSync(pin, salt, 64);
    const expected = Buffer.from(storedHash, "hex");

    if (
      calculated.length !== expected.length ||
      !timingSafeEqual(calculated, expected)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid mobile number or PIN." },
        { status: 401 }
      );
    }

    const token = createDeliverySession({
      partnerId: String(partner.id),
      phone: String(partner.phone),
      name: String(partner.full_name),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });

    const response = NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.full_name,
        phone: partner.phone,
      },
    });

    response.cookies.set(COOKIE_NAME, token, deliveryCookieOptions());
    return response;
  } catch (error) {
    console.error("Delivery partner login error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to login. Please try again." },
      { status: 500 }
    );
  }
}
