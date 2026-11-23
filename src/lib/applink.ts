// src/lib/applink.ts — call Applink through the static-IP proxy. SERVER-SIDE ONLY: import it from src/app/api/**/route.ts or server actions, never from "use client" files.
//
// Vercel environment variables:
//   APPLINK_PROXY_URL     e.g. https://140-245-12-34.sslip.io   (no trailing slash)
//   APPLINK_PROXY_SECRET  same value as PROXY_SECRET on the VM
//   APPLINK_APP_ID        e.g. APP_000123
//   APPLINK_PASSWORD      your Applink app password

export type ApplinkResponse = { statusCode: string; statusDetail?: string; [key: string]: unknown };

export async function applink(path: string, body: Record<string, unknown>): Promise<ApplinkResponse> {
  const res = await fetch(`${process.env.APPLINK_PROXY_URL}/applink/${path.replace(/^\/+/, '')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-secret': process.env.APPLINK_PROXY_SECRET ?? '',
    },
    body: JSON.stringify({
      applicationId: process.env.APPLINK_APP_ID,
      password: process.env.APPLINK_PASSWORD,
      ...body,
    }),
    cache: 'no-store',
  });
  return (await res.json()) as ApplinkResponse;
}

// Examples:
// await applink('sms/send', { version: '1.0', message: 'Hello', destinationAddresses: ['tel:88019XXXXXXXX'], deliveryStatusRequest: '1' });
// await applink('otp/request', { subscriberId: 'tel:88019XXXXXXXX' });
// await applink('caas/direct/debit', { externalTrxId, amount: '5.00', paymentInstrumentName: 'Mobile Account', subscriberId: 'tel:88019XXXXXXXX', Currency: 'BDT' });
// Success only when result.statusCode === 'S1000' (P = pending, E = error, PROXY_* = proxy problem).
