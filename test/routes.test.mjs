import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import { createRequestHandler } from "../src/app.mjs";

const servers = [];
const silentLogger = {
  info() {},
  error() {},
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertGatewayError(body, code, message, data = {}) {
  assert.match(body.request_id, UUID_PATTERN);
  assert.deepEqual(body.output, {
    code,
    message: `[happyoyster-sdk-demo-node] ${message}`,
    data,
  });
}

function testConfig() {
  return {
    host: "127.0.0.1",
    port: 0,
    bailianGatewayBaseUrlsByMode: {
      1: "https://example.test/api/v2/apps/adventure-app",
      2: "https://example.test/api/v2/apps/directing-app",
      3: "https://example.test/api/v2/apps/acting-app",
    },
    bailianApiOrigin: "https://example.test",
    dashscopeApiKey: "sk-test",
    requestTimeoutMs: 1_000,
  };
}

async function startTestServer(fetchImpl) {
  const server = createServer(
    createRequestHandler({
      config: testConfig(),
      fetchImpl,
      logger: silentLogger,
    }),
  );

  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

async function assertProxyMapping({
  requestPath,
  expectedUrl,
  method = "GET",
  body,
  expectedBody,
}) {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(String(url), expectedUrl);
    assert.equal(init.method, method);
    assert.equal(init.headers.authorization, "Bearer sk-test");
    if (expectedBody === undefined) {
      assert.equal(init.body, undefined);
    } else {
      assert.equal(Buffer.from(init.body).toString("utf8"), expectedBody);
    }
    return new Response(JSON.stringify({ code: 0, data: "ok" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: {
      "X-Happy-Oyster-Mode": "2",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: "ok" });
}

test("GET /server-api/worlds maps to OpenAPI worlds list", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds?page=1&filter=a%20b&mode=2",
    );
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.headers.authorization, "Bearer sk-test");
    return new Response(JSON.stringify({ code: 0, data: [] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  const response = await fetch(
    `${baseUrl}/server-api/worlds?page=1&filter=a%20b&mode=2`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: [] });
});

test("Bailian business errors pass through unchanged", async () => {
  const upstreamBody = {
    request_id: "upstream-request-id",
    output: {
      code: 400000,
      message: "Bailian validation failed",
      data: {},
    },
  };
  const baseUrl = await startTestServer(async () =>
    new Response(JSON.stringify(upstreamBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

  const response = await fetch(`${baseUrl}/server-api/worlds?mode=2`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), upstreamBody);
});

test("POST /server-api/worlds maps to OpenAPI world creation", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.equal(Buffer.from(init.body).toString("utf8"), '{"mode":2,"title":"oyster"}');
    return new Response(JSON.stringify({ code: 0, data: { id: 1 } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  const response = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Happy-Oyster-Mode": "2",
    },
    body: JSON.stringify({ mode: 2, title: "oyster" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: { id: 1 } });
});

test("POST /server-api/worlds preserves request body bytes", async () => {
  const body = '{\n  "mode": 2,\n  "prompt": "oyster"\n}';
  await assertProxyMapping({
    requestPath: "/server-api/worlds",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds",
    method: "POST",
    body,
    expectedBody: body,
  });
});

for (const [mode, appId] of [
  [1, "adventure-app"],
  [2, "directing-app"],
  [3, "acting-app"],
]) {
  test(`POST /server-api/worlds routes mode ${mode}`, async () => {
    const body = JSON.stringify({ mode, async: true });
    const baseUrl = await startTestServer(async (url, init) => {
      assert.equal(
        String(url),
        `https://example.test/api/v2/apps/${appId}/openapi/v1/worlds`,
      );
      assert.equal(init.headers.authorization, "Bearer sk-test");
      assert.equal(init.headers["x-happy-oyster-mode"], undefined);
      return new Response(JSON.stringify({ request_id: "upstream", output: { code: 0 } }));
    });

    const response = await fetch(`${baseUrl}/server-api/worlds`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-happy-oyster-mode": String(mode),
      },
      body,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      request_id: "upstream",
      output: { code: 0 },
    });
  });
}

test("GET /server-api/worlds selects the app from query mode", async () => {
  const baseUrl = await startTestServer(async (url) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/acting-app/openapi/v1/worlds?page=1&mode=3",
    );
    return new Response(JSON.stringify({ request_id: "upstream", output: { code: 0 } }));
  });

  const response = await fetch(`${baseUrl}/server-api/worlds?page=1&mode=3`);
  assert.equal(response.status, 200);
});

test("follow-up routes select the app from X-Happy-Oyster-Mode", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds/build-status?encryptedWorldId=ENC_WORLD",
    );
    assert.equal(init.headers["x-happy-oyster-mode"], undefined);
    return new Response(JSON.stringify({ request_id: "upstream", output: { code: 0 } }));
  });

  const response = await fetch(
    `${baseUrl}/server-api/worlds/build-status?encryptedWorldId=ENC_WORLD`,
    { headers: { "X-Happy-Oyster-Mode": "2" } },
  );
  assert.equal(response.status, 200);
});

test("routes reject missing or conflicting mode values", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("invalid mode must not call upstream");
  });

  const missing = await fetch(`${baseUrl}/server-api/worlds/build-status`);
  assert.equal(missing.status, 200);
  assertGatewayError(
    await missing.json(),
    "PARAM_INVALID",
    "Requests require mode 1, 2, or 3 in the request or x-happy-oyster-mode",
  );

  const conflict = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-happy-oyster-mode": "1",
    },
    body: JSON.stringify({ mode: 2 }),
  });
  assert.equal(conflict.status, 200);
  assertGatewayError(
    await conflict.json(),
    "PARAM_INVALID",
    "Request mode values must match",
  );

  const duplicate = await fetch(`${baseUrl}/server-api/worlds?mode=1&mode=2`);
  assert.equal(duplicate.status, 200);
  assertGatewayError(
    await duplicate.json(),
    "PARAM_INVALID",
    "Request mode values must match",
  );

  const invalid = await fetch(`${baseUrl}/server-api/worlds?mode=4`);
  assert.equal(invalid.status, 200);
  assertGatewayError(
    await invalid.json(),
    "PARAM_INVALID",
    "Request mode must be 1, 2, or 3",
  );
});

test("POST /server-api/worlds forwards first_frame fields", async () => {
  const requestBody = {
    mode: 1,
    async: true,
    perspective: "first_person",
    prompt: "A neon oyster market at night",
    uploadMode: "first_frame",
    firstFrameImage: {
      url: "https://cdn.example.com/landscape.jpg",
      referenceType: "default",
    },
  };

  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/adventure-app/openapi/v1/worlds",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.deepEqual(JSON.parse(Buffer.from(init.body).toString("utf8")), requestBody);
    return new Response(JSON.stringify({ code: 0, data: { id: 1 } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  const response = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: { id: 1 } });
});

test("POST /server-api/worlds forwards scriptlist base64 image refs", async () => {
  const requestBody = {
    mode: 2,
    async: true,
    creationModel: "scriptlist",
    resolution: "720p",
    firstFrameImage: {
      base64: "data:image/png;base64,iVBORw0KGgo=",
    },
    scriptList: {
      synopsis: "A rainy neon street.",
      subjects: [
        {
          label: "[character_1]",
          type: "character",
          refImage: {
            base64: "UkVGX0lNQUdF",
            referenceType: "default",
          },
        },
      ],
      acts: [
        {
          turn: 1,
          content: "[character_1] looks at the rain.",
        },
      ],
    },
  };

  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.deepEqual(JSON.parse(Buffer.from(init.body).toString("utf8")), requestBody);
    return new Response(JSON.stringify({ code: 0, data: { id: 1 } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  });

  const response = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: { id: 1 } });
});

test("POST /server-api/travel-credential maps to get-travel-credential", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds/get-travel-credential",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.equal(
      Buffer.from(init.body).toString("utf8"),
      '{"encryptedWorldId":"ENC_WORLD"}',
    );
    return new Response(
      JSON.stringify({ code: 0, data: { ticket: "tk_test" } }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  });

  const response = await fetch(`${baseUrl}/server-api/travel-credential`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Happy-Oyster-Mode": "2",
    },
    body: JSON.stringify({ encryptedWorldId: "ENC_WORLD" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: 0,
    data: { ticket: "tk_test" },
  });
});

test("GET /server-api/worlds/build-status maps to OpenAPI build status", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/worlds/build-status?encryptedWorldId=ENC_WORLD",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds/build-status?encryptedWorldId=ENC_WORLD",
  });
});

test("GET /server-api/worlds/detail maps to OpenAPI world detail", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/worlds/detail?encryptedWorldId=ENC_WORLD",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds/detail?encryptedWorldId=ENC_WORLD",
  });
});

test("POST /server-api/worlds/delete maps to OpenAPI world deletion", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/worlds/delete",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/worlds/delete",
    method: "POST",
    body: JSON.stringify({ encryptedWorldId: "ENC_WORLD" }),
    expectedBody: '{"encryptedWorldId":"ENC_WORLD"}',
  });
});

test("GET /server-api/travels maps to OpenAPI travels list", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/travels?page=1&pageSize=20",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/travels?page=1&pageSize=20",
  });
});

test("GET /server-api/travels/artifacts maps to OpenAPI artifacts", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/travels/artifacts?encryptedTravelId=ENC_TRAVEL",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/travels/artifacts?encryptedTravelId=ENC_TRAVEL",
  });
});

test("POST /server-api/travels/update-script maps to OpenAPI script update", async () => {
  const body = JSON.stringify({
    encryptedTravelId: "ENC_TRAVEL",
    scriptList: {
      acts: Array.from({ length: 45 }, (_, index) => ({
        turn: index + 1,
        content: `act ${index + 1}`,
      })),
    },
    userAgent: "sdk-test/1.0",
  });

  await assertProxyMapping({
    requestPath: "/server-api/travels/update-script",
    expectedUrl:
      "https://example.test/api/v2/apps/directing-app/openapi/v1/travels/update-script",
    method: "POST",
    body,
    expectedBody: body,
  });
});

test("POST /server-api/temp-api-key mints temporary DashScope key", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v1/tokens?expire_in_seconds=1800",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.equal(init.body, undefined);
    return new Response(
      JSON.stringify({ token: "st-test", expires_at: 1744080369 }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  });

  const response = await fetch(
    `${baseUrl}/server-api/temp-api-key?expire_in_seconds=1800`,
    {
      method: "POST",
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    token: "st-test",
    expires_at: 1744080369,
  });
});

test("POST /server-api/temp-api-key rejects invalid ttl", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("invalid ttl must not call upstream");
  });

  const response = await fetch(`${baseUrl}/server-api/temp-api-key`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ expireInSeconds: 1801 }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assertGatewayError(
    body,
    "PARAM_INVALID",
    "expire_in_seconds must be an integer between 1 and 1800",
  );
});

test("POST /server-api/temp-api-key rejects boolean ttl", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("invalid ttl must not call upstream");
  });
  const response = await fetch(`${baseUrl}/server-api/temp-api-key`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ expireInSeconds: true }),
  });

  assert.equal(response.status, 200);
  assertGatewayError(
    await response.json(),
    "PARAM_INVALID",
    "expire_in_seconds must be an integer between 1 and 1800",
  );
});

test("POST /server-api/temp-api-key rejects non-object JSON body", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("invalid body must not call upstream");
  });

  const response = await fetch(`${baseUrl}/server-api/temp-api-key`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "null",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assertGatewayError(body, "PARAM_INVALID", "request body must be a JSON object");
});

test("unknown path returns a gateway error", async () => {
  const baseUrl = await startTestServer(async () => new Response("unused"));
  const response = await fetch(`${baseUrl}/missing`);

  assert.equal(response.status, 200);
  assertGatewayError(await response.json(), "NOT_FOUND", "Not Found");
});

test("unknown server-api path returns a gateway error", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("unknown path must not call upstream");
  });
  const response = await fetch(`${baseUrl}/server-api/typo`);

  assert.equal(response.status, 200);
  assertGatewayError(await response.json(), "NOT_FOUND", "Not Found");
});

test("unsupported method returns a gateway error", async () => {
  const baseUrl = await startTestServer(async () => new Response("unused"));
  const response = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "OPTIONS",
  });

  assert.equal(response.status, 200);
  assertGatewayError(
    await response.json(),
    "METHOD_NOT_ALLOWED",
    "Method Not Allowed",
  );
});

test("upstream failure returns a Bailian-compatible gateway envelope", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("network down");
  });

  const response = await fetch(`${baseUrl}/server-api/worlds?mode=2`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assertGatewayError(body, "UPSTREAM_ERROR", "Upstream OpenAPI request failed");
});
