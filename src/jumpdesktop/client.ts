import { config } from "../config";
import {
  ApiError,
  DeviceConnectionUrls,
  JumpDesktopApiError,
  TeamDeviceInfo,
  TeamUserInfo,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.jumpDesktopApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.jumpDesktopApiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let errors: ApiError[] = [];
    try {
      const body = (await res.json()) as { errors?: ApiError[] };
      errors = body?.errors ?? [];
    } catch {
      // response body wasn't JSON; fall through with empty errors
    }
    throw new JumpDesktopApiError(res.status, errors);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Find a team member by email. Returns undefined if no user matches. */
export async function findTeamUserByEmail(
  teamId: string,
  email: string
): Promise<TeamUserInfo | undefined> {
  const data = await request<{ users: TeamUserInfo[] }>(
    `/v1/team/${teamId}/users?email=${encodeURIComponent(email)}`
  );
  return data.users[0];
}

/** List/search devices on a team, optionally filtered by name (supports * wildcards). */
export async function listTeamDevices(
  teamId: string,
  nameQuery?: string
): Promise<TeamDeviceInfo[]> {
  const qs = nameQuery ? `?name=${encodeURIComponent(nameQuery)}` : "";
  const data = await request<{ devices: TeamDeviceInfo[] }>(
    `/v1/team/${teamId}/devices${qs}`
  );
  return data.devices;
}

/** List/search users on a team, optionally filtered by name substring (client-side). */
export async function listTeamUsers(teamId: string): Promise<TeamUserInfo[]> {
  const data = await request<{ users: TeamUserInfo[] }>(
    `/v1/team/${teamId}/users`
  );
  return data.users;
}

/**
 * Grant one or more users remote access to a device. Additive — does not
 * remove any existing members. This is the core action of the GFX access
 * request flow.
 */
export async function grantDeviceAccess(
  teamId: string,
  deviceId: string,
  userIds: string[]
): Promise<void> {
  await request(`/v1/team/${teamId}/device/${deviceId}/members`, {
    method: "POST",
    body: JSON.stringify({ users: userIds }),
  });
}

/** Revoke remote access for one or more users on a device. */
export async function revokeDeviceAccess(
  teamId: string,
  deviceId: string,
  userIds: string[]
): Promise<void> {
  await request(`/v1/team/${teamId}/device/${deviceId}/members/delete`, {
    method: "POST",
    body: JSON.stringify({ users: userIds }),
  });
}

/** Get stable connect/dashboard URLs for a device, for the confirmation message. */
export async function getDeviceConnectionUrls(
  teamId: string,
  deviceId: string
): Promise<DeviceConnectionUrls> {
  return request<DeviceConnectionUrls>(
    `/v1/team/${teamId}/device/${deviceId}/urls`
  );
}
