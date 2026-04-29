import { createHmac } from "crypto";

export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function getWebhookHeaders(
  payload: string,
  secret?: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(secret && {
      "X-Webhook-Signature": `sha256=${computeWebhookSignature(payload, secret)}`,
    }),
  };
}
