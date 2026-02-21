import { NextResponse } from "next/server";
import { isEmailAllowed, generateCode, storeCode } from "@/lib/auth/gate";
import { Resend } from "resend";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.trim()?.toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!isEmailAllowed(email)) {
    // Don't reveal whether the email exists
    return NextResponse.json({ ok: true });
  }

  const code = generateCode();
  await storeCode(email, code);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: `Deal Analysis <reports@${process.env.RESEND_DOMAIN || "resend.dev"}>`,
        to: [email],
        subject: `Your access code: ${code}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #18181b; padding: 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 18px;">Deal Analysis</h1>
    </div>
    <div style="padding: 32px; text-align: center;">
      <p style="margin: 0 0 16px; color: #71717a; font-size: 14px;">Your access code is:</p>
      <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #18181b; padding: 16px; background: #f4f4f5; border-radius: 8px;">${code}</div>
      <p style="margin: 16px 0 0; color: #a1a1aa; font-size: 12px;">Expires in 10 minutes.</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (err) {
      console.error("Failed to send gate code email:", err);
      return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
    }
  } else {
    // Dev mode: log to console
    console.log(`[GATE] Code for ${email}: ${code}`);
  }

  return NextResponse.json({ ok: true });
}
