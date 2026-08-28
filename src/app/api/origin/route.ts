import { NextResponse } from "next/server";
import { resolveMichiganOrigin } from "../../../lib/live-data";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

type OriginRequest = {
  origin: string;
};

function validRequest(value: unknown): value is OriginRequest {
  if (!value || typeof value !== "object") return false;
  const origin = (value as Record<string, unknown>).origin;
  return typeof origin === "string" && origin.trim().length >= 2 && origin.trim().length <= 80;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4_000) {
      return NextResponse.json({ error: "That location is too long." }, { status: 400, headers });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send a valid Michigan city or ZIP." }, { status: 400, headers });
  }

  if (!validRequest(body)) {
    return NextResponse.json({ error: "Enter a Michigan city or ZIP." }, { status: 400, headers });
  }

  try {
    const origin = await resolveMichiganOrigin(body.origin);
    if (!origin) {
      return NextResponse.json(
        { error: "I could not match that to a Michigan city or ZIP. Try a nearby city or ZIP code." },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ origin }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Location lookup is temporarily unavailable. Try again or use your current location." },
      { status: 503, headers },
    );
  }
}
