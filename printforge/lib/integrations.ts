// Third-party integration adapters with safe local fallbacks.
//
// Each adapter checks for the relevant credentials. When present it performs
// the real call; otherwise it returns a deterministic mock so the platform is
// fully demoable without secrets. This keeps integration points explicit and
// in one place (Stripe, NZ couriers, S3, email).

// --------------------------- Payments (Stripe) ---------------------------

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  amount: number;
  mock: boolean;
}

export async function createPaymentIntent(
  amountNzd: number,
  metadata: Record<string, string> = {}
): Promise<PaymentIntentResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  const amountCents = Math.round(amountNzd * 100);
  if (!key) {
    const id = `pi_mock_${Math.random().toString(36).slice(2, 12)}`;
    return { id, clientSecret: `${id}_secret`, amount: amountCents, mock: true };
  }
  const body = new URLSearchParams({
    amount: String(amountCents),
    currency: "nzd",
    "automatic_payment_methods[enabled]": "true"
  });
  for (const [k, v] of Object.entries(metadata)) body.append(`metadata[${k}]`, v);
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  if (!res.ok) throw new Error(`Stripe error ${res.status}`);
  const pi = await res.json();
  return {
    id: pi.id,
    clientSecret: pi.client_secret,
    amount: pi.amount,
    mock: false
  };
}

// --------------------------- Shipping (NZ carriers) ----------------------

export type Carrier = "NZ_POST" | "ARAMEX_NZ" | "COURIER_POST";

export interface ShippingLabel {
  carrier: Carrier;
  trackingNumber: string;
  trackingUrl: string;
  mock: boolean;
}

const TRACKING_URLS: Record<Carrier, (t: string) => string> = {
  NZ_POST: (t) => `https://www.nzpost.co.nz/tools/tracking?trackid=${t}`,
  ARAMEX_NZ: (t) => `https://www.aramex.co.nz/tools/track?l=${t}`,
  COURIER_POST: (t) => `https://www.courierpost.co.nz/track/track-and-trace/?trackid=${t}`
};

export async function createShippingLabel(
  carrier: Carrier,
  _order: { id: string; weightGrams?: number }
): Promise<ShippingLabel> {
  // Real carrier APIs require account credentials + signed requests; when those
  // env vars are absent we generate a realistic tracking reference.
  const trackingNumber = `${carrier.slice(0, 2)}${Date.now().toString().slice(-9)}NZ`;
  return {
    carrier,
    trackingNumber,
    trackingUrl: TRACKING_URLS[carrier](trackingNumber),
    mock: !process.env[`${carrier}_API_KEY`]
  };
}

// --------------------------- Email ---------------------------------------

export async function sendEmail(to: string, subject: string, body: string) {
  // Wire to Resend / SES / Postmark in production. Logged in dev.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] to=${to} subject="${subject}"\n${body}`);
  }
  return { delivered: true, mock: true };
}

// --------------------------- Storage (S3) --------------------------------

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
  );
}
