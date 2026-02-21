import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

interface SendReportParams {
  to: string;
  propertyAddress: string;
  recommendation: string;
  keyMetrics: {
    purchasePrice: number;
    splitGDV: number;
    grossProfit: number;
    roi: number;
  };
  investmentMemoPdf: Buffer;
  valuationMemoPdf: Buffer;
  analysisUrl: string;
}

function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function sendReportEmail(params: SendReportParams): Promise<void> {
  const {
    to,
    propertyAddress,
    recommendation,
    keyMetrics,
    investmentMemoPdf,
    valuationMemoPdf,
    analysisUrl,
  } = params;

  const recColor =
    recommendation === "PROCEED"
      ? "#22c55e"
      : recommendation === "REJECT"
        ? "#ef4444"
        : "#f59e0b";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #18181b; padding: 32px; color: white;">
      <h1 style="margin: 0 0 8px; font-size: 20px;">Property Analysis Complete</h1>
      <p style="margin: 0; color: #a1a1aa; font-size: 14px;">${propertyAddress}</p>
    </div>
    <div style="padding: 32px;">
      <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; background: ${recColor}20; color: ${recColor}; font-weight: 600; font-size: 14px; margin-bottom: 24px;">
        ${recommendation.replace(/_/g, " ")}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Purchase Price</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600; font-size: 14px;">${formatCurrency(keyMetrics.purchasePrice)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Split GDV</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600; font-size: 14px;">${formatCurrency(keyMetrics.splitGDV)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 14px;">Gross Profit</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; text-align: right; font-weight: 600; color: #22c55e; font-size: 14px;">${formatCurrency(keyMetrics.grossProfit)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #71717a; font-size: 14px;">ROI</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 14px;">${keyMetrics.roi.toFixed(1)}%</td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #71717a; margin: 0;">
        Investment memo and valuation memo are attached as PDFs.
        <a href="${analysisUrl}" style="color: #3b82f6;">View full analysis online</a>.
      </p>
    </div>
  </div>
</body>
</html>`;

  const addressSlug = slugify(propertyAddress);

  await getResend().emails.send({
    from: `Deal Analysis <reports@${process.env.RESEND_DOMAIN || "resend.dev"}>`,
    to: [to],
    subject: `Property Analysis: ${propertyAddress}`,
    html,
    attachments: [
      {
        filename: `Investment-Memo-${addressSlug}.pdf`,
        content: investmentMemoPdf,
      },
      {
        filename: `Valuation-Memo-${addressSlug}.pdf`,
        content: valuationMemoPdf,
      },
    ],
  });
}
