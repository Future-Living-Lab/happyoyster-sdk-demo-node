import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnv } from "../src/config/env.mjs";

const API_HOST = "llm-example.cn-beijing.maas.aliyuncs.com";
const GATEWAY_BASE_URL = `https://${API_HOST}/api/v2/apps/happyoyster-1.0`;

test("loadEnv requires dashscope api key", () => {
  assert.throws(
    () => loadEnv({ BAILIAN_API_HOST: API_HOST }),
    /DASHSCOPE_API_KEY is required/,
  );
});

test("loadEnv requires bailian api host", () => {
  assert.throws(
    () => loadEnv({ DASHSCOPE_API_KEY: "sk-test" }),
    /BAILIAN_API_HOST is required/,
  );
});

test("loadEnv rejects malformed bailian api host", () => {
  assert.throws(
    () => loadEnv({ BAILIAN_API_HOST: "not a host", DASHSCOPE_API_KEY: "sk-test" }),
    /BAILIAN_API_HOST must be a valid Bailian API Host/,
  );
});

test("loadEnv rejects bailian api host with query", () => {
  assert.throws(
    () =>
      loadEnv({
        BAILIAN_API_HOST: `${API_HOST}?debug=true`,
        DASHSCOPE_API_KEY: "sk-test",
      }),
    /BAILIAN_API_HOST must be a valid Bailian API Host/,
  );
});

test("loadEnv rejects full bailian api url", () => {
  assert.throws(
    () =>
      loadEnv({
        BAILIAN_API_HOST: `https://${API_HOST}/api/v2/apps/happyoyster-1.0/openapi/v1`,
        DASHSCOPE_API_KEY: "sk-test",
      }),
    /BAILIAN_API_HOST must be a valid Bailian API Host/,
  );
});

test("loadEnv defaults to local settings", () => {
  const config = loadEnv({
    BAILIAN_API_HOST: API_HOST,
    DASHSCOPE_API_KEY: "sk-test",
  });

  assert.equal(config.bailianGatewayBaseUrl, GATEWAY_BASE_URL);
  assert.equal(config.bailianApiOrigin, `https://${API_HOST}`);
  assert.equal(config.dashscopeApiKey, "sk-test");
  assert.equal(config.requestTimeoutMs, 130_000);
});

test("loadEnv requires nonblank dashscope api key", () => {
  assert.throws(
    () => loadEnv({ BAILIAN_API_HOST: API_HOST, DASHSCOPE_API_KEY: " " }),
    /DASHSCOPE_API_KEY is required/,
  );
});

test("loadEnv accepts bailian settings", () => {
  const config = loadEnv({
    DASHSCOPE_API_KEY: "sk-test",
    BAILIAN_API_HOST: API_HOST,
    PORT: "3100",
    REQUEST_TIMEOUT_MS: "5000",
  });

  assert.equal(config.dashscopeApiKey, "sk-test");
  assert.equal(config.bailianGatewayBaseUrl, GATEWAY_BASE_URL);
  assert.equal(config.bailianApiOrigin, `https://${API_HOST}`);
  assert.equal(config.port, 3100);
  assert.equal(config.requestTimeoutMs, 5_000);
});
