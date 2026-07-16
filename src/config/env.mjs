const DEFAULTS = {
  host: "127.0.0.1",
  port: 3000,
  requestTimeoutMs: 130_000,
};

const BAILIAN_GATEWAY_PATH = "api/v2/apps/happyoyster-1.0";
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
      `${name} must be a valid Bailian API Host, e.g. llm-<your-workspace-id>.cn-beijing.maas.aliyuncs.com`,
    );
  }

  return {
    gatewayBaseUrl: `https://${apiHost}/${BAILIAN_GATEWAY_PATH}`,
    origin: `https://${apiHost}`,
  };
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
    bailianGatewayBaseUrl: bailianApi.gatewayBaseUrl,
    bailianApiOrigin: bailianApi.origin,
    dashscopeApiKey,
    requestTimeoutMs: parseInteger(
      "REQUEST_TIMEOUT_MS",
      env.REQUEST_TIMEOUT_MS,
      DEFAULTS.requestTimeoutMs,
    ),
  };
}
