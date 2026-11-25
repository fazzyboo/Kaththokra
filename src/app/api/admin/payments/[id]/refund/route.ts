import { z } from "zod";
import { ROLES } from "@/server/auth/roles";
import { requireAdmin } from "@/server/auth/session";
import { readJson, wrap } from "@/server/http/handler";
import { refundPayment } from "@/server/services/admin-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Params = z.object({ id: z.string().regex(/^p-[0-9a-f]{1,16}$/, "invalid payment id") });
const Body = z.object({ note: z.string().trim().max(300).optional() });

/** POST /api/admin/payments/[id]/refund { note? } → LedgerRow (DISPUTED → REFUNDED_MANUAL) */
export const POST = wrap<{ id: string }>(async (req, { params }) => {
  const auth = await requireAdmin(ROLES.payments);
  const { id } = Params.parse(params);
  const { note } = await readJson(req, Body);
  return refundPayment(id, note, auth);
});
