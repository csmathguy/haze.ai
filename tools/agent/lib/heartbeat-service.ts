import { writeHeartbeatEvent } from "../../../apps/audit/api/src/services/heartbeat-store.js";
import type { HeartbeatEventInput } from "../../../apps/audit/api/src/services/heartbeat-store.js";

export type { HeartbeatEventInput };

export async function writeHeartbeat(input: HeartbeatEventInput): Promise<void> {
  const options =
    process.env.AUDIT_DATABASE_URL === undefined ? {} : { databaseUrl: process.env.AUDIT_DATABASE_URL };
  await writeHeartbeatEvent(input, options);
}
