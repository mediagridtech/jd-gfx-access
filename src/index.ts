import { App } from "@slack/bolt";
import { config } from "./config";
import { registerHandlers } from "./slack/handlers";

const app = new App({
  token: config.slackBotToken,
  appToken: config.slackAppToken,
  socketMode: true,
});

registerHandlers(app);

(async () => {
  await app.start();
  console.log("JD GFX Access Request app is running (Socket Mode)");
})();
