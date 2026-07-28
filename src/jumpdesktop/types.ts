// Shapes mirror the relevant subset of https://jumpdesktop.com/openapi/openapi.json

export interface TeamUserInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: "admin" | "user";
  remoteAccess?: "enabled" | "disabled";
}

export interface TeamDeviceInfo {
  id: string;
  name: string;
  users: string[];
  groups?: string;
  lastOnlineAt?: number;
}

export interface DeviceConnectionUrls {
  connect: string;
  dashboard: string;
  askScreenShare: string;
}

export interface ApiError {
  code?: string;
  detail?: string;
  status?: number;
}

export class JumpDesktopApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errors: ApiError[]
  ) {
    super(errors.map((e) => e.detail).filter(Boolean).join("; ") || `Jump Desktop API error (${status})`);
    this.name = "JumpDesktopApiError";
  }
}
