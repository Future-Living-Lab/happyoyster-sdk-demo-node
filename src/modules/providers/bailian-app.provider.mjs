import { fetchUpstream } from "../../lib/upstream-client.mjs";
import { copyForwardableHeaders, hasHeader } from "./header-utils.mjs";

function buildOpenApiPath(path) {
  return path.replace(/^\/+/, "");
}

function buildHeaders(proxyRequest, config) {
  const headers = copyForwardableHeaders(proxyRequest.headers);

  headers.authorization = `Bearer ${config.dashscopeApiKey}`;

  if (proxyRequest.body && !hasHeader(headers, "content-type")) {
    headers["content-type"] = "application/json";
  }

  if (!hasHeader(headers, "user-agent")) {
    headers["user-agent"] = "happyoyster-sdk-demo-node";
  }

  return headers;
}

export async function callBailianApp(proxyRequest, { config, fetchImpl }) {
  // Trailing slash + relative path keep the gateway path when new URL(path, origin) resolves.
  return fetchUpstream({
    origin: `${config.bailianGatewayBaseUrl}/`,
    path: buildOpenApiPath(proxyRequest.path),
    search: proxyRequest.search,
    method: proxyRequest.method,
    headers: buildHeaders(proxyRequest, config),
    body: proxyRequest.body,
    timeoutMs: config.requestTimeoutMs,
    fetchImpl,
  });
}
