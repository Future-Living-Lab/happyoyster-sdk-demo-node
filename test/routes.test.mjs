import assert from "node:assert/strict";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import { createRequestHandler } from "../src/app.mjs";

const servers = [];
const silentLogger = {
  info() {},
  error() {},
};

function testConfig() {
  return {
    host: "127.0.0.1",
    port: 0,
    bailianGatewayBaseUrl: "https://example.test/api/v2/apps/happyoyster-1.0",
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
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: "ok" });
}

test("GET /server-api/worlds maps to OpenAPI worlds list", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds?page=1&filter=a%20b",
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
    `${baseUrl}/server-api/worlds?page=1&filter=a%20b`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: [] });
});

test("POST /server-api/worlds maps to OpenAPI world creation", async () => {
  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds",
    );
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer sk-test");
    assert.equal(Buffer.from(init.body).toString("utf8"), '{"title":"oyster"}');
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
    body: JSON.stringify({ title: "oyster" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0, data: { id: 1 } });
});

test("POST /server-api/worlds preserves request body bytes", async () => {
  const body = '{\n  "mode": 2,\n  "prompt": "oyster"\n}';
  await assertProxyMapping({
    requestPath: "/server-api/worlds",
    expectedUrl:
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds",
    method: "POST",
    body,
    expectedBody: body,
  });
});

test("POST /server-api/worlds forwards scenario_role fields", async () => {
  const requestBody = {
    mode: 1,
    async: true,
    perspective: "first_person",
    uploadMode: "scenario_role",
    scenePrompt: "A neon oyster market at night",
    rolePrompt: "A cheerful robot guide",
    sceneImage: {
      url: "https://cdn.example.com/scene.jpg",
      referenceType: "default",
    },
    roleImage: {
      url: "https://cdn.example.com/role.jpg",
      referenceType: "default",
    },
    inputImages: [
      {
        base64: "SU5QVVRfSU1BR0U=",
        referenceType: "default",
      },
    ],
  };

  const baseUrl = await startTestServer(async (url, init) => {
    assert.equal(
      String(url),
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds",
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
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds",
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
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds/get-travel-credential",
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
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds/build-status?encryptedWorldId=ENC_WORLD",
  });
});

test("GET /server-api/worlds/detail maps to OpenAPI world detail", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/worlds/detail?encryptedWorldId=ENC_WORLD",
    expectedUrl:
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds/detail?encryptedWorldId=ENC_WORLD",
  });
});

test("POST /server-api/worlds/delete maps to OpenAPI world deletion", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/worlds/delete",
    expectedUrl:
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/worlds/delete",
    method: "POST",
    body: JSON.stringify({ encryptedWorldId: "ENC_WORLD" }),
    expectedBody: '{"encryptedWorldId":"ENC_WORLD"}',
  });
});

test("GET /server-api/travels maps to OpenAPI travels list", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/travels?page=1&pageSize=20",
    expectedUrl:
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/travels?page=1&pageSize=20",
  });
});

test("GET /server-api/travels/artifacts maps to OpenAPI artifacts", async () => {
  await assertProxyMapping({
    requestPath: "/server-api/travels/artifacts?encryptedTravelId=ENC_TRAVEL",
    expectedUrl:
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/travels/artifacts?encryptedTravelId=ENC_TRAVEL",
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
      "https://example.test/api/v2/apps/happyoyster-1.0/openapi/v1/travels/update-script",
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

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    errorCode: "PARAM_INVALID",
    message: "expire_in_seconds must be an integer between 1 and 1800",
  });
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

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    errorCode: "PARAM_INVALID",
    message: "expire_in_seconds must be an integer between 1 and 1800",
  });
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

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    errorCode: "PARAM_INVALID",
    message: "request body must be a JSON object",
  });
});

test("unknown path returns 404", async () => {
  const baseUrl = await startTestServer(async () => new Response("unused"));
  const response = await fetch(`${baseUrl}/missing`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found\n");
});

test("unknown server-api path returns 404", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("unknown path must not call upstream");
  });
  const response = await fetch(`${baseUrl}/server-api/typo`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found\n");
});

test("unsupported method returns 405", async () => {
  const baseUrl = await startTestServer(async () => new Response("unused"));
  const response = await fetch(`${baseUrl}/server-api/worlds`, {
    method: "OPTIONS",
  });

  assert.equal(response.status, 405);
  assert.equal(await response.text(), "Method Not Allowed\n");
});

test("upstream failure returns stable 502 envelope", async () => {
  const baseUrl = await startTestServer(async () => {
    throw new Error("network down");
  });

  const response = await fetch(`${baseUrl}/server-api/worlds`);
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.deepEqual(body, {
    success: false,
    errorCode: "UPSTREAM_ERROR",
    message: "Upstream OpenAPI request failed",
  });
});
