import { serve } from "@hono/node-server";
import { createClaudeCaller } from "./claude.ts";
import { JobStore } from "./jobs.ts";
import { createApp } from "./routes.ts";

if (!process.env.APP_ACCESS_CODE) console.warn("APP_ACCESS_CODE is not set: anyone who finds this server can use it.");

const call = createClaudeCaller();
const app = createApp({ jobs: new JobStore(call), call, accessCode: process.env.APP_ACCESS_CODE });
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`API listening on http://localhost:${port}`));
