import assert from "node:assert/strict";
import { test } from "node:test";
import { callBailianApp } from "../src/modules/providers/bailian-app.provider.mjs";

function response(body = "ok") {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("bailian provider prefixes app path and strips internal gateway headers", async () => {
  const body = Buffer.from(JSON.stringify({ title: "oyster" }));

  await callBailianApp(
    {
      method: "POST",
      path: "/openapi/v1/worlds",
      search: "?dry_run=true",
      headers: {
        "content-type": "application/json",
        "x-dashscope-uid": "must-not-forward",
        "x-dashscope-inner-entity-id": "must-not-forward",
        "x-ho-uid": "must-not-forward",
      },
      body,
    },
    {
      config: {
        bailianGatewayBaseUrl: "https://bailian.example.test/api/v2/apps/happyoyster-1.0",
        bailianApiOrigin: "https://bailian.example.test",
        dashscopeApiKey: "sk-test",
        requestTimeoutMs: 1_000,
      },
      fetchImpl: async (url, init) => {
        assert.equal(
          String(url),
          "https://bailian.example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds?dry_run=true",
        );
        assert.equal(init.method, "POST");
        assert.equal(init.headers.authorization, "Bearer sk-test");
        assert.equal(init.headers["content-type"], "application/json");
        assert.equal(init.headers["x-dashscope-uid"], undefined);
        assert.equal(init.headers["x-dashscope-inner-entity-id"], undefined);
        assert.equal(init.headers["x-ho-uid"], undefined);
        assert.equal(init.body, body);
        return response();
      },
    },
  );
});
