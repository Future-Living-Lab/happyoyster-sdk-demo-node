import { GatewayError } from "../../lib/gateway-error.mjs";
import { sendBody, textHeaders } from "../../lib/http.mjs";
import { readRequestBody } from "../../lib/request-body.mjs";
import { callBailianApp } from "../providers/bailian-app.provider.mjs";

function normalizeMode(value) {
  const mode = typeof value === "string" ? Number(value) : value;
  if (mode !== 1 && mode !== 2 && mode !== 3) {
    throw new GatewayError(
      "PARAM_INVALID",
      "Request mode must be 1, 2, or 3",
    );
  }
  return mode;
}

function readBodyMode(body) {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body.toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed.mode
      : undefined;
  } catch {
    return undefined;
  }
}

function resolveAppMode(req, context, body) {
  const candidates = [req.headers["x-happy-oyster-mode"]];
  if (context.upstreamPath === "/openapi/v1/worlds" && req.method === "GET") {
    candidates.push(...context.url.searchParams.getAll("mode"));
  }
  if (context.upstreamPath === "/openapi/v1/worlds" && req.method === "POST") {
    candidates.push(readBodyMode(body));
  }

  const modes = candidates.filter((value) => value !== undefined).map(normalizeMode);
  if (modes.length === 0) {
    throw new GatewayError(
      "PARAM_INVALID",
      "Requests require mode 1, 2, or 3 in the request or x-happy-oyster-mode",
    );
  }
  if (modes.some((mode) => mode !== modes[0])) {
    throw new GatewayError(
      "PARAM_INVALID",
      "Request mode values must match",
    );
  }
  return modes[0];
}

export async function handleProxy(req, res, context) {
  const body = await readRequestBody(req);
  const mode = resolveAppMode(req, context, body);
  const proxyRequest = {
    method: req.method,
    path: context.upstreamPath,
    search: context.url.search,
    headers: req.headers,
    body,
    mode,
  };

  const upstream = await callBailianApp(proxyRequest, context);
  sendBody(res, upstream.statusCode, upstream.body, {
    "content-type": upstream.contentType || textHeaders["content-type"],
  });
}
