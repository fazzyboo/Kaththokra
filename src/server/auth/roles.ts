import "server-only";
import type { AdminRole } from "./session";

/** Admin route roles (BACKEND_PLAN.md §6 Admin table). Empty = any signed-in admin. */
export const ROLES = {
  any: [] as AdminRole[],
  liveLog: ["admin", "analyst"] as AdminRole[],
  review: ["admin", "agronomist"] as AdminRole[],
  payments: ["admin"] as AdminRole[],
  dealers: ["admin", "dealer_manager"] as AdminRole[],
  subscribers: ["admin"] as AdminRole[],
  alerts: ["admin", "agronomist"] as AdminRole[],
  kb: ["admin", "agronomist"] as AdminRole[],
  team: ["admin"] as AdminRole[],
  settings: ["admin"] as AdminRole[],
};
