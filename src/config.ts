import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  slackBotToken: requireEnv("SLACK_BOT_TOKEN"),
  slackAppToken: requireEnv("SLACK_APP_TOKEN"),
  jumpDesktopApiToken: requireEnv("JUMPDESKTOP_API_TOKEN"),
  jumpDesktopApiBaseUrl: "https://api.jumpdesktop.com",
  auditChannelId: process.env.AUDIT_CHANNEL_ID || undefined,
  offices: {
    NY: requireEnv("JUMPDESKTOP_NY_TEAM_ID"),
    LA: requireEnv("JUMPDESKTOP_LA_TEAM_ID"),
  },
} as const;

export type OfficeCode = keyof typeof config.offices;
