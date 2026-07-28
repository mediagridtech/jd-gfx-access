import { App } from "@slack/bolt";
import { config } from "../config";
import {
  findTeamUserByEmail,
  grantDeviceAccess,
  listTeamDevices,
  listTeamUsers,
} from "../jumpdesktop/client";
import { JumpDesktopApiError } from "../jumpdesktop/types";
import { ACTION_IDS, BLOCK_IDS, buildRequestModal, CALLBACK_ID } from "./modal";
import { isOfficeCode, teamIdForOffice } from "./teams";

/** Slash command that opens the request modal. Rename to match whatever command you register in the Slack app config. */
const OPEN_MODAL_COMMAND = "/jdgfxaccess";

/** The office selection is threaded through private_metadata — see modal.ts for why. */
function officeFromPrivateMetadata(privateMetadata: string | undefined): string | undefined {
  if (!privateMetadata) return undefined;
  try {
    return (JSON.parse(privateMetadata) as { office?: string }).office ?? undefined;
  } catch {
    return undefined;
  }
}

export function registerHandlers(app: App): void {
  app.command(OPEN_MODAL_COMMAND, async ({ ack, body, client }) => {
    await ack();
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildRequestModal(),
    });
  });

  // Office select has dispatch_action: true (see modal.ts), so changing it
  // fires this handler. Push the choice into private_metadata so the
  // computer/user options handlers below can read it back.
  app.action(ACTION_IDS.office, async ({ ack, body, client, action }) => {
    await ack();
    if (action.type !== "static_select" || !("view" in body) || !body.view) return;

    const office = action.selected_option?.value;
    if (!office || !isOfficeCode(office)) return;

    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildRequestModal(office),
    });
  });

  // Populate the "Which computer?" dropdown, scoped to the chosen office.
  app.options(ACTION_IDS.computer, async ({ options, body, ack }) => {
    const office = officeFromPrivateMetadata(body.view?.private_metadata);
    if (!office || !isOfficeCode(office)) {
      await ack({ options: [] });
      return;
    }

    const teamId = teamIdForOffice(office);
    const query = options.value?.trim();
    const devices = await listTeamDevices(teamId, query ? `*${query}*` : undefined);

    await ack({
      options: devices.slice(0, 100).map((d) => ({
        text: { type: "plain_text", text: d.name },
        value: d.id,
      })),
    });
  });

  // Populate the "Who needs access?" dropdown, scoped to the chosen office's team.
  app.options(ACTION_IDS.user, async ({ options, body, ack }) => {
    const office = officeFromPrivateMetadata(body.view?.private_metadata);
    if (!office || !isOfficeCode(office)) {
      await ack({ options: [] });
      return;
    }

    const teamId = teamIdForOffice(office);
    const query = options.value?.trim().toLowerCase() ?? "";
    const users = await listTeamUsers(teamId);
    const matches = users.filter((u) => {
      const haystack = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.email}`.toLowerCase();
      return haystack.includes(query);
    });

    await ack({
      options: matches.slice(0, 100).map((u) => ({
        text: {
          type: "plain_text",
          text: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email,
        },
        value: u.email,
      })),
    });
  });

  app.view(CALLBACK_ID, async ({ ack, view, body, client }) => {
    const values = view.state.values;
    const office = values[BLOCK_IDS.office]?.[ACTION_IDS.office]?.selected_option?.value;
    const computer = values[BLOCK_IDS.computer]?.[ACTION_IDS.computer]?.selected_option;
    const requesterEmail = values[BLOCK_IDS.user]?.[ACTION_IDS.user]?.selected_option?.value;

    if (!office || !isOfficeCode(office) || !computer || !requesterEmail) {
      await ack({
        response_action: "errors",
        errors: { [BLOCK_IDS.office]: "All fields are required." },
      });
      return;
    }

    await ack();

    const submitterId = body.user.id;
    const teamId = teamIdForOffice(office);

    try {
      const requester = await findTeamUserByEmail(teamId, requesterEmail);
      if (!requester) {
        throw new Error(
          `${requesterEmail} was not found on the ${office} Jump Desktop team. They must already be a team member before access can be granted.`
        );
      }

      await grantDeviceAccess(teamId, computer.value, [requester.id]);

      const confirmation = `:white_check_mark: Granted *${requesterEmail}* access to *${computer.text.text}* (${office}).`;
      await client.chat.postMessage({ channel: submitterId, text: confirmation });
      if (config.auditChannelId) {
        await client.chat.postMessage({ channel: config.auditChannelId, text: confirmation });
      }
    } catch (err) {
      const detail = err instanceof JumpDesktopApiError ? err.message : (err as Error).message;
      await client.chat.postMessage({
        channel: submitterId,
        text: `:x: Couldn't grant access to *${computer.text.text}*: ${detail}`,
      });
    }
  });
}
