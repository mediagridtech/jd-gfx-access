import fs from "fs";
import path from "path";

/** A grant issued through this app that should be auto-revoked once it expires. */
export interface ActiveGrant {
  id: string;
  teamId: string;
  office: string;
  deviceId: string;
  deviceName: string;
  userId: string;
  userEmail: string;
  channelId: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
}

// Mounted as a Docker volume in production (see PROJECT_PLAN.md) — without a
// volume, this file (and any pending expirations) would be wiped on every
// `docker run` redeploy.
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "grants.json");

export function loadGrants(): ActiveGrant[] {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as ActiveGrant[];
  } catch {
    return [];
  }
}

function saveGrants(grants: ActiveGrant[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(grants, null, 2));
}

export function addGrant(grant: ActiveGrant): void {
  const grants = loadGrants();
  grants.push(grant);
  saveGrants(grants);
}

export function removeGrant(id: string): void {
  saveGrants(loadGrants().filter((g) => g.id !== id));
}
