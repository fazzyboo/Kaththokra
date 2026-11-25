import "server-only";
import { col } from "../db/collections";
import { log } from "../lib/log";

/*
  Append-only audit trail (auditLog). Every admin sign-in and every admin mutation writes
  one row. meta must never contain passwords, codes or full phone numbers.
*/

export async function audit(actor: string, action: string, entity: string, entityId: string, meta?: Record<string, unknown>) {
  try {
    const auditLog = await col("auditLog");
    await auditLog.insertOne({ actor, action, entity, entityId, at: new Date(), ...(meta ? { meta } : {}) });
  } catch (err) {
    // Never block the action on the audit write, but make the gap visible.
    log.error("audit.write_failed", { action, entity, entityId, err });
  }
}
