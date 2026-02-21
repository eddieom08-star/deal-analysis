import { NextResponse } from "next/server";
import { GATE_COOKIE_NAME } from "@/lib/auth/gate";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
