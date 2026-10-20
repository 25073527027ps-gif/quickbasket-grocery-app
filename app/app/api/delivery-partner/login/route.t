
import { NextRequest, NextResponse } from "next/server";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { SUPABASE_URL, SUPABASE_SECRET_KEY, DELIVERY_SESSION_SECRET } =
      process.env;

    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !DELIVERY_SESSION_SECRET) {
      return NextResponse.json(
        { success: false, message: "Server configuration is incomplete." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    const pin = String(body.pin ?? "");

    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid mobile number and 6-digit PIN." },
        { status: 400 }
      );
    }

    const url = new URL("/rest/v1/delivery_partners", SUPABASE_URL);
    url.searchParams.set("phone", `eq.${phone}`);
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("select", "id,phone,full_name,pin_hash");
    url.searchParams.set("limit", "1");

    const dbResponse = await fetch(url, {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      },
      cache: "no-store",
    });

    if (!dbResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Unable to verify login." },
        { status: 500 }
      );
    }

    const partners = await dbResponse.json();
    const partner = partners[0];

    if (!partner?.pin_hash || typeof partner.pin_hash !== "string") {
      return NextResponse.json(
        { success: false, message: "Invalid mobile number or PIN." },
        { status: 401 }
      );
    }

    const [salt, storedHash] = partner.pin_hash.split(":");

    if (
      !salt ||
      !storedHash ||
      !/^[a-f0-9]{128}$/i.test(storedHash)
    ) {
      return NextResponse.json(
        { success: false, message: "PIN setup is incomplete. Contact admin." },
        { status: 401 }
      );
    }

    const calculated = scryptSync(pin, salt, 64);
    const expected = Buffer.from(storedHash, "hex");

    if (
      expected.length !== calculated.length ||
      !timingSafeEqual(calculated, expected)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid mobile number or PIN." },
        { status: 401 }
      );
    }

    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({ partnerId: partner.id, exp: expiresAt })
    ).toString("base64url");

    const signature = createHmac("sha256", DELIVERY_SESSION_SECRET)
      .update(payload)
      .digest("base64url");

    const response = NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.full_name,
        phone: partner.phone,
      },
    });

    response.cookies.set("qb_delivery_session", `${payload}.${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request." },
      { status: 400 }
    );
  }
}

