// API docs — /api-docs (Swagger UI) aur /api-docs.json (spec) bina API key ke; baaki API phir bhi key maangti hai
// chalao: npm test (backend/ se) — alag test DB (test/helpers.js)
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestApp } = require("./helpers");

const ctx = setupTestApp("docs");

before(() => ctx.start());
after(() => ctx.stop());

test("/api-docs bina API key ke khulta hai (HTML), spec OpenAPI 3 aur dono security schemes", async () => {
  const page = await fetch(`${ctx.baseUrl}/api-docs/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(await page.text(), /swagger-ui/);
  // key/token browser ke localStorage mein na rahein (shared computer) — init script mein setting
  const init = await (await fetch(`${ctx.baseUrl}/api-docs/swagger-ui-init.js`)).text();
  assert.match(init, /"persistAuthorization": false/);
  // "Try it out" ki tasveer (blob: URL) — docs page par ijazat, warna toota icon; baaki API par nahi
  assert.match(page.headers.get("content-security-policy"), /img-src 'self' data: blob:/);
  const api = await fetch(`${ctx.baseUrl}/auth/refresh`, { method: "POST", headers: { "x-api-key": ctx.config.apiKey } });
  assert.doesNotMatch(api.headers.get("content-security-policy"), /blob:/);

  const spec = await ctx.request("GET", "/api-docs.json", { apiKey: null });
  assert.equal(spec.status, 200);
  assert.equal(spec.json.openapi, "3.0.3");
  assert.deepEqual(Object.keys(spec.json.components.securitySchemes).sort(), ["ApiKeyAuth", "BearerAuth"]);
  assert.deepEqual(spec.json.security, [{ ApiKeyAuth: [] }]);
});

test("docs public hone se API public nahi hui — bina key ke 401", async () => {
  assert.equal((await ctx.request("POST", "/auth/login/request-otp", { apiKey: null, body: {} })).status, 401);
  assert.equal((await ctx.request("GET", "/api-docs-anything", { apiKey: null })).status, 401);
});

// naya route bana aur docs bhool gaye — yahan pakda jaye (list app.js ke routes se)
test("spec mein har endpoint hai, aur har response ka koi example/schema", async () => {
  const { json: spec } = await ctx.request("GET", "/api-docs.json", { apiKey: null });
  const documented = Object.entries(spec.paths).flatMap(([p, ops]) =>
    Object.keys(ops).filter((m) => m !== "parameters").map((m) => `${m.toUpperCase()} ${p}`)
  );
  const expected = [
    "POST /auth/register", "POST /auth/verify-email", "POST /auth/resend-verification", "POST /auth/login",
    "POST /auth/login/request-otp", "POST /auth/login/verify-otp", "POST /auth/refresh", "POST /auth/logout",
    "GET /tasks", "POST /tasks", "GET /tasks/{id}", "PUT /tasks/{id}", "DELETE /tasks/{id}",
    "POST /user/upload-avatar", "GET /user/profile", "PATCH /user/profile",
    "GET /tickets", "POST /tickets", "GET /tickets/{id}",
    "POST /files/{fileId}/signed-url", "GET /files/{fileId}",
    "GET /orgs", "POST /orgs", "GET /orgs/{orgId}", "PATCH /orgs/{orgId}", "DELETE /orgs/{orgId}",
    "GET /orgs/{orgId}/members", "GET /orgs/{orgId}/members/{userId}",
    "DELETE /orgs/{orgId}/members/{userId}", "PATCH /orgs/{orgId}/members/{userId}/role",
    "POST /orgs/{orgId}/leave", "POST /orgs/{orgId}/transfer-ownership",
    "GET /orgs/{orgId}/invitations", "POST /orgs/{orgId}/invitations", "DELETE /orgs/{orgId}/invitations/{inviteId}",
    "GET /invitations/{token}", "POST /invitations/{token}/accept",
    "GET /invitations", "POST /invitations/received/{inviteId}/accept", "POST /invitations/received/{inviteId}/decline"
  ];
  assert.deepEqual(documented.sort(), expected.sort());

  // har $ref kisi asli component par
  const broken = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.$ref === "string") {
      const target = node.$ref.replace("#/", "").split("/").reduce((at, key) => at && at[key], spec);
      if (!target) broken.push(node.$ref);
    }
    Object.values(node).forEach(walk);
  };
  walk(spec);
  assert.deepEqual(broken, []);
});

test("429 ki shakal RateLimitError — message + retryAfter + resetAt (request-otp par dono soorten)", async () => {
  const { json: spec } = await ctx.request("GET", "/api-docs.json", { apiKey: null });
  const schema = spec.components.schemas.RateLimitError;
  assert.deepEqual(schema.required, ["message", "retryAfter", "resetAt"]);
  assert.equal(schema.properties.retryAfter.type, "integer");
  assert.equal(schema.properties.resetAt.format, "date-time");

  const tooMany = spec.paths["/auth/login/request-otp"].post.responses["429"];
  assert.equal(tooMany.content["application/json"].schema.$ref, "#/components/schemas/RateLimitError");
  assert.deepEqual(Object.keys(tooMany.content["application/json"].examples).sort(), ["codeLimit", "ipLimit"]);
  assert.ok(tooMany.headers["Retry-After"]);

  // upload routes multipart + had description mein
  const avatar = spec.paths["/user/upload-avatar"].post;
  assert.ok(avatar.requestBody.content["multipart/form-data"]);
  assert.match(avatar.description, /2 MB/);
  assert.match(spec.paths["/tickets"].post.description, /2 MB[\s\S]*5 MB[\s\S]*PDF/);
});
