import { App } from "@slack/bolt";
import { revokeDeviceAccess } from "../jumpdesktop/client";
import { ActiveGrant, loadGrants, removeGrant } from "./store";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

async function expireGrant(app: App, grant: ActiveGrant): Promise<void> {
  await revokeDeviceAccess(grant.teamId, grant.deviceId, [grant.userId]);
  removeGrant(grant.id);
  await app.client.chat.postMessage({
    channel: grant.channelId,
    text:
      `:hourglass_flowing_sand: Access for *${grant.userEmail}* to *${grant.deviceName}* (${grant.office}) ` +
      `has expired after ${daysBetween(grant.grantedAt, grant.expiresAt)} day(s) and was automatically revoked ` +
      `(originally granted by <@${grant.grantedBy}>).`,
  });
}

/** Polls the grants store for anything past its expiry and revokes it. Also
 * catches up on anything that expired while the app was stopped/redeploying. */
export function startExpirationScheduler(app: App): void {
  const checkOnce = async () => {
    const now = Date.now();
    for (const grant of loadGrants()) {
      if (new Date(grant.expiresAt).getTime() > now) continue;
      try {
        await expireGrant(app, grant);
      } catch (err) {
        console.error(`[scheduler] failed to expire grant ${grant.id} (${grant.userEmail} / ${grant.deviceName}):`, err);
      }
    }
  };

  void checkOnce();
  setInterval(() => void checkOnce(), CHECK_INTERVAL_MS);
}
