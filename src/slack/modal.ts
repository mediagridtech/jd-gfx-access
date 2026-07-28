import { View } from "@slack/bolt";
import { OfficeCode } from "../config";
import { OFFICE_OPTIONS } from "./teams";

export const CALLBACK_ID = "jd_gfx_access_submit";

export const BLOCK_IDS = {
  office: "office_block",
  computer: "computer_block",
  user: "user_block",
} as const;

export const ACTION_IDS = {
  office: "office_action",
  computer: "computer_action",
  user: "user_action",
} as const;

/**
 * Builds the "JD GFX Access Request" modal. The computer and user fields are
 * external_select menus — Slack calls our options handlers (see handlers.ts)
 * live as the user types, scoped to whichever office they picked.
 *
 * Slack's block_suggestions (options) payload does NOT reliably include the
 * value of sibling fields in view.state.values — that's only populated at
 * view_submission time. So the selected office is threaded through via
 * private_metadata instead: handlers.ts pushes a views.update with the
 * chosen office stashed here whenever the office select changes, and the
 * options handlers read it back from private_metadata rather than state.
 */
export function buildRequestModal(selectedOffice?: OfficeCode): View {
  return {
    type: "modal",
    callback_id: CALLBACK_ID,
    private_metadata: JSON.stringify({ office: selectedOffice ?? null }),
    title: { type: "plain_text", text: "JD GFX Access Request" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: BLOCK_IDS.office,
        dispatch_action: true,
        label: { type: "plain_text", text: "Which office is the machine located in?" },
        element: {
          type: "static_select",
          action_id: ACTION_IDS.office,
          placeholder: { type: "plain_text", text: "Select an option" },
          ...(selectedOffice
            ? {
                initial_option: {
                  text: { type: "plain_text", text: selectedOffice },
                  value: selectedOffice,
                },
              }
            : {}),
          options: OFFICE_OPTIONS.map((o) => ({
            text: { type: "plain_text", text: o.label },
            value: o.value,
          })),
        },
      },
      {
        type: "input",
        block_id: BLOCK_IDS.computer,
        label: { type: "plain_text", text: "Which computer?" },
        element: {
          type: "external_select",
          action_id: ACTION_IDS.computer,
          placeholder: { type: "plain_text", text: "Select an office first, then search" },
          min_query_length: 0,
        },
      },
      {
        type: "input",
        block_id: BLOCK_IDS.user,
        label: { type: "plain_text", text: "Who needs access?" },
        element: {
          type: "external_select",
          action_id: ACTION_IDS.user,
          placeholder: { type: "plain_text", text: "Select an office first, then search" },
          min_query_length: 0,
        },
      },
    ],
  };
}
