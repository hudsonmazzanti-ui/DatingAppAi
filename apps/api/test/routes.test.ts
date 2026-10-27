import { describe, expect, it } from "vitest";
import { JobStore } from "../src/jobs.ts";
import { createApp } from "../src/routes.ts";
import { stubCaller } from "./helpers.ts";

const { call } = stubCaller([]);
const app = createApp({ jobs: new JobStore(call), call, accessCode: "secret" });

describe("routes", () => {
  it("leaves /health open but checks the access code everywhere else", async () => {
    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/access")).status).toBe(401);
    expect((await app.request("/access", { headers: { "x-access-code": "wrong" } })).status).toBe(401);
    expect((await app.request("/access", { headers: { "x-access-code": "secret" } })).status).toBe(200);
  });

  it("asks for Google sign-in when the token is missing", async () => {
    const res = await app.request("/picker/sessions", { method: "POST", headers: { "x-access-code": "secret" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown jobs", async () => {
    const res = await app.request("/jobs/nope", { headers: { "x-access-code": "secret" } });
    expect(res.status).toBe(404);
  });
});
