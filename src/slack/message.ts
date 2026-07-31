import { KnownBlock } from "@slack/bolt";
import { OFFICE_OPTIONS } from "./teams";

export const ACTION_IDS = {
  office: "gfx_office_select",
  computer: "gfx_computer_select",
  user: "gfx_user_select",
  duration: "gfx_duration_select",
  submit: "gfx_submit",
  cancel: "gfx_cancel",
} as const;

export const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
];

export interface RequestState {
  requesterId: string;
  office?: string;
  computer?: { id: string; name: string };
  requesterEmail?: string;
  requesterLabel?: string;
  durationDays?: number;
  status?: "submitted" | "cancelled" | "error";
  statusDetail?: string;
}

/**
 * Builds the in-channel "JD GFX Access Request" message. Unlike a modal,
 * a channel message has no built-in field-state tracking, so the caller
 * (handlers.ts) is responsible for holding RequestState per message and
 * rebuilding these blocks via chat.update after every selection.
 */
export function buildRequestBlocks(state: RequestState): KnownBlock[] {
  if (state.status === "submitted") {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: state.statusDetail ?? `:white_check_mark: Request completed by <@${state.requesterId}>.` },
      },
    ];
  }
  if (state.status === "cancelled") {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: `Request cancelled by <@${state.requesterId}>.` },
      },
    ];
  }
  if (state.status === "error") {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: state.statusDetail ?? `:x: Something went wrong with this request.` },
      },
    ];
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*JD GFX Access Request* — requested by <@${state.requesterId}>` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: state.office ? `*Office:* ${state.office}` : "*Which office is the machine located in?*" },
      accessory: {
        type: "static_select",
        action_id: ACTION_IDS.office,
        placeholder: { type: "plain_text", text: "Select an option" },
        ...(state.office
          ? { initial_option: { text: { type: "plain_text", text: state.office }, value: state.office } }
          : {}),
        options: OFFICE_OPTIONS.map((o) => ({
          text: { type: "plain_text", text: o.label },
          value: o.value,
        })),
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: state.computer ? `*Computer:* ${state.computer.name}` : "*Which computer?*" },
      accessory: {
        type: "external_select",
        action_id: ACTION_IDS.computer,
        placeholder: { type: "plain_text", text: state.office ? "Search computers" : "Pick an office first" },
        min_query_length: 0,
        ...(state.computer
          ? { initial_option: { text: { type: "plain_text", text: state.computer.name }, value: state.computer.id } }
          : {}),
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: state.requesterEmail ? `*Who needs access:* ${state.requesterEmail}` : "*Who needs access?*" },
      accessory: {
        type: "external_select",
        action_id: ACTION_IDS.user,
        placeholder: { type: "plain_text", text: state.office ? "Search people" : "Pick an office first" },
        min_query_length: 0,
        ...(state.requesterEmail
          ? {
              initial_option: {
                text: { type: "plain_text", text: state.requesterLabel ?? state.requesterEmail },
                value: state.requesterEmail,
              },
            }
          : {}),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: state.durationDays ? `*Duration:* ${state.durationDays} day(s)` : "*How many days should access last?*",
      },
      accessory: {
        type: "static_select",
        action_id: ACTION_IDS.duration,
        placeholder: { type: "plain_text", text: "Select a duration" },
        ...(state.durationDays
          ? {
              initial_option: {
                text: { type: "plain_text", text: `${state.durationDays} day(s)` },
                value: String(state.durationDays),
              },
            }
          : {}),
        options: DURATION_OPTIONS.map((o) => ({
          text: { type: "plain_text", text: o.label },
          value: String(o.days),
        })),
      },
    },
    {
      type: "actions",
      elements: [
        { type: "button", action_id: ACTION_IDS.submit, style: "primary", text: { type: "plain_text", text: "Submit" } },
        { type: "button", action_id: ACTION_IDS.cancel, text: { type: "plain_text", text: "Cancel" } },
      ],
    },
  ];
}
