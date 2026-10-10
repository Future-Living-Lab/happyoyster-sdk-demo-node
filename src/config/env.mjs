const DEFAULTS = {
  host: "127.0.0.1",
  port: 3000,
  requestTimeoutMs: 130_000,
};

const APP_IDS = {
  1: "happyoyster-1.0-adventure",
  2: "happyoyster-1.0-directing",
  3: "happyoyster-1.0-acting",
};
const API_HOST_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function parseInteger(name, value, fallback) {
  if (value === undefined || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function normalizeApiHost(name, apiHost) {
  if (!API_HOST_PATTERN.test(apiHost)) {
    throw new Error(
      `${name} must be a valid Bailian API Host, e.g. your-api-host.maas.aliyuncs.com`,
    );
  }

  return {
    apiHost,
    origin: `https://${apiHost}`,
  };
}

function gatewayBaseUrl(apiHost, appId) {
  return `https://${apiHost}/api/v2/apps/${appId}`;
}

function requireNonBlank(name, value) {
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`${name} is required`);
  }
  return String(value).trim();
}

export function loadEnv(env = process.env) {
  const bailianApi = normalizeApiHost(
    "BAILIAN_API_HOST",
    requireNonBlank("BAILIAN_API_HOST", env.BAILIAN_API_HOST),
  );
  const dashscopeApiKey = requireNonBlank("DASHSCOPE_API_KEY", env.DASHSCOPE_API_KEY);
  return {
    host: env.HOST || DEFAULTS.host,
    port: parseInteger("PORT", env.PORT, DEFAULTS.port),
    bailianGatewayBaseUrlsByMode: Object.fromEntries(
      Object.entries(APP_IDS).map(([mode, appId]) => [
        mode,
        gatewayBaseUrl(bailianApi.apiHost, appId),
      ]),
    ),
    bailianApiOrigin: bailianApi.origin,
    dashscopeApiKey,
    requestTimeoutMs: parseInteger(
      "REQUEST_TIMEOUT_MS",
      env.REQUEST_TIMEOUT_MS,
      DEFAULTS.requestTimeoutMs,
    ),
  };
}
