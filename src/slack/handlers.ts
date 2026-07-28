import { App } from "@slack/bolt";
import { config } from "../config";
import {
  findTeamUserByEmail,
  grantDeviceAccess,
  listTeamDevices,
  listTeamUsers,
} from "../jumpdesktop/client";
import { JumpDesktopApiError } from "../jumpdesktop/types";
import { ACTION_IDS, buildRequestBlocks, RequestState } from "./message";
import { isOfficeCode, teamIdForOffice } from "./teams";

/** Slash command that posts the request form into the channel. */
const OPEN_REQUEST_COMMAND = "/jdgfxaccess";

// Per-message state. Fine for a single-instance app (see PROJECT_PLAN.md's
// "only one Socket Mode connection per token" constraint) — if this ever
// runs as multiple replicas, this needs to move to a shared store.
const pendingRequests = new Map<string, RequestState>();

function stateKey(channel: string, ts: string): string {
  return `${channel}:${ts}`;
}

export function registerHandlers(app: App): void {
  app.command(OPEN_REQUEST_COMMAND, async ({ ack, body, client }) => {
    await ack();
    const state: RequestState = { requesterId: body.user_id };
    const posted = await client.chat.postMessage({
      channel: body.channel_id,
      text: "JD GFX Access Request",
      blocks: buildRequestBlocks(state),
    });
    if (posted.channel && posted.ts) {
      pendingRequests.set(stateKey(posted.channel, posted.ts), state);
    }
  });

  app.action(ACTION_IDS.office, async ({ ack, body, client, action, respond }) => {
    await ack();
    if (action.type !== "static_select" || !("message" in body) || !body.message || !body.channel) return;

    const key = stateKey(body.channel.id, body.message.ts);
    const state = pendingRequests.get(key);
    if (!state) return;
    if (body.user.id !== state.requesterId) {
      await respond({ response_type: "ephemeral", text: "Only the person who started this request can fill it out." });
      return;
    }

    const office = action.selected_option?.value;
    if (!office || !isOfficeCode(office)) return;

    // Changing office invalidates any computer/user already chosen for the old office.
    state.office = office;
    state.computer = undefined;
    state.requesterEmail = undefined;
    state.requesterLabel = undefined;

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "JD GFX Access Request",
      blocks: buildRequestBlocks(state),
    });
  });

  app.action(ACTION_IDS.computer, async ({ ack, body, client, action, respond }) => {
    await ack();
    if (action.type !== "external_select" || !("message" in body) || !body.message || !body.channel) return;

    const key = stateKey(body.channel.id, body.message.ts);
    const state = pendingRequests.get(key);
    if (!state) return;
    if (body.user.id !== state.requesterId) {
      await respond({ response_type: "ephemeral", text: "Only the person who started this request can fill it out." });
      return;
    }

    const selected = action.selected_option;
    if (!selected?.value) return;
    state.computer = { id: selected.value, name: selected.text.text };

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "JD GFX Access Request",
      blocks: buildRequestBlocks(state),
    });
  });

  app.action(ACTION_IDS.user, async ({ ack, body, client, action, respond }) => {
    await ack();
    if (action.type !== "external_select" || !("message" in body) || !body.message || !body.channel) return;

    const key = stateKey(body.channel.id, body.message.ts);
    const state = pendingRequests.get(key);
    if (!state) return;
    if (body.user.id !== state.requesterId) {
      await respond({ response_type: "ephemeral", text: "Only the person who started this request can fill it out." });
      return;
    }

    const selected = action.selected_option;
    if (!selected?.value) return;
    state.requesterEmail = selected.value;
    state.requesterLabel = selected.text.text;

    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "JD GFX Access Request",
      blocks: buildRequestBlocks(state),
    });
  });

  // Populate the "Which computer?" dropdown, scoped to the chosen office.
  app.options(ACTION_IDS.computer, async ({ options, body, ack }) => {
    const channelId = body.channel?.id ?? body.container?.channel_id;
    const messageTs = body.container?.message_ts;
    const state = channelId && messageTs ? pendingRequests.get(stateKey(channelId, messageTs)) : undefined;
    if (!state?.office || !isOfficeCode(state.office)) {
      await ack({ options: [] });
      return;
    }

    const teamId = teamIdForOffice(state.office);
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
    const channelId = body.channel?.id ?? body.container?.channel_id;
    const messageTs = body.container?.message_ts;
    const state = channelId && messageTs ? pendingRequests.get(stateKey(channelId, messageTs)) : undefined;
    if (!state?.office || !isOfficeCode(state.office)) {
      await ack({ options: [] });
      return;
    }

    const teamId = teamIdForOffice(state.office);
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

  app.action(ACTION_IDS.cancel, async ({ ack, body, client, respond }) => {
    await ack();
    if (!("message" in body) || !body.message || !body.channel) return;

    const key = stateKey(body.channel.id, body.message.ts);
    const state = pendingRequests.get(key);
    if (!state) return;
    if (body.user.id !== state.requesterId) {
      await respond({ response_type: "ephemeral", text: "Only the person who started this request can cancel it." });
      return;
    }

    state.status = "cancelled";
    pendingRequests.delete(key);
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: "JD GFX Access Request cancelled",
      blocks: buildRequestBlocks(state),
    });
  });

  app.action(ACTION_IDS.submit, async ({ ack, body, client, respond }) => {
    await ack();
    if (!("message" in body) || !body.message || !body.channel) return;

    const key = stateKey(body.channel.id, body.message.ts);
    const state = pendingRequests.get(key);
    if (!state) return;
    if (body.user.id !== state.requesterId) {
      await respond({ response_type: "ephemeral", text: "Only the person who started this request can submit it." });
      return;
    }
    if (!state.office || !isOfficeCode(state.office) || !state.computer || !state.requesterEmail) {
      await respond({ response_type: "ephemeral", text: "Fill in office, computer, and requester before submitting." });
      return;
    }

    const teamId = teamIdForOffice(state.office);

    try {
      const requester = await findTeamUserByEmail(teamId, state.requesterEmail);
      if (!requester) {
        throw new Error(
          `${state.requesterEmail} was not found on the ${state.office} Jump Desktop team. They must already be a team member before access can be granted.`
        );
      }

      await grantDeviceAccess(teamId, state.computer.id, [requester.id]);

      state.status = "submitted";
      state.statusDetail = `:white_check_mark: <@${state.requesterId}> granted *${state.requesterEmail}* access to *${state.computer.name}* (${state.office}).`;
      pendingRequests.delete(key);

      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "JD GFX Access Request completed",
        blocks: buildRequestBlocks(state),
      });

      if (config.auditChannelId) {
        await client.chat.postMessage({ channel: config.auditChannelId, text: state.statusDetail });
      }
    } catch (err) {
      const detail = err instanceof JumpDesktopApiError ? err.message : (err as Error).message;
      state.status = "error";
      state.statusDetail = `:x: Couldn't grant access to *${state.computer.name}*: ${detail}`;
      pendingRequests.delete(key);

      await client.chat.update({
        channel: body.channel.id,
        ts: body.message.ts,
        text: "JD GFX Access Request failed",
        blocks: buildRequestBlocks(state),
      });
    }
  });
}
