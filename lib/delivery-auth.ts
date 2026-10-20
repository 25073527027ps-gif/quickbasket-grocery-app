
import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type DeliverySession = {
  partnerId: string;
  phone: string;
  name: string;
  expiresAt: number;
};

const COOKIE_NAME = "qb_delivery_session";
const SESSION_SECRET = process.env.DELIVERY_SESSION_SECRET || "";

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("hex");
}

export function createDeliverySession(
  session: DeliverySession
): string {
  if (!SESSION_SECRET) {
    throw new Error("DELIVERY_SESSION_SECRET is not configured");
  }

  const payload = Buffer.from(JSON.stringify(session)).toString(
    "base64url"
  );
  return `${payload}.${sign(payload)}`;
}

export function readDeliverySession(
  request: NextRequest
): DeliverySession | null {
  if (!SESSION_SECRET) return null;

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as DeliverySession;

    if (
      !session.partnerId ||
      !session.phone ||
      !session.name ||
      !session.expiresAt ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function deliveryCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

export async function supabaseRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

export async function responseMessage(
  response: Response
): Promise<string> {
  try {
    const body = await response.json();
    return (
      body?.message ||
      body?.hint ||
      body?.details ||
      body?.error ||
      `Request failed (${response.status})`
    );
  } catch {
    return `Request failed (${response.status})`;
  }
}

export { COOKIE_NAME };
