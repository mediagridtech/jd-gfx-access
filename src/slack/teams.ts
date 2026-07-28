import { config, OfficeCode } from "../config";

export const OFFICE_OPTIONS: { label: string; value: OfficeCode }[] = [
  { label: "NY", value: "NY" },
  { label: "LA", value: "LA" },
];

export function teamIdForOffice(office: OfficeCode): string {
  return config.offices[office];
}

export function isOfficeCode(value: string): value is OfficeCode {
  return value === "NY" || value === "LA";
}
