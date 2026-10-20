
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type DeliverySession = {
  partnerId: string;
  exp: number;
};

export function readDeliverySession(
  request: NextRequest
): DeliverySession | null {
  const secret = process.env.DELIVERY_SESSION_SECRET;
  const token = request.cookies.get("qb_delivery_session")?.value;

  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as DeliverySession;

    if (
      !data.partnerId ||
      typeof data.exp !== "number" ||
      data.exp < Date.now()
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export async function supabaseRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Server configuration is incomplete.");
  }

  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });
}

export async function responseMessage(
  response: Response
): Promise<string> {
  const raw = await response.text();

  try {
    const parsed = JSON.parse(raw);
    return parsed.message || parsed.details || parsed.hint || raw;
  } catch {
    return raw || `HTTP ${response.status}`;
  }
}

