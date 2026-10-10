import { sendBody, sendGatewayError, textHeaders } from "../../lib/http.mjs";
import { readRequestBody } from "../../lib/request-body.mjs";
import { normalizeExpireInSeconds, requestTemporaryApiKey } from "./token.service.mjs";

function parseJsonBody(rawBody) {
  if (!rawBody || rawBody.length === 0) return {};

  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("request body must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request body must be a JSON object");
  }
  return parsed;
}

function pickExpireInSeconds(url, body) {
  return (
    url.searchParams.get("expire_in_seconds")
    ?? body.expire_in_seconds
    ?? body.expireInSeconds
  );
}

export async function handleTemporaryApiKey(req, res, context) {
  let expireInSeconds;
  try {
    const body = parseJsonBody(await readRequestBody(req));
    expireInSeconds = normalizeExpireInSeconds(pickExpireInSeconds(context.url, body));
  } catch (error) {
    sendGatewayError(res, "PARAM_INVALID", error.message);
    return;
  }

  const upstream = await requestTemporaryApiKey({
    expireInSeconds,
    config: context.config,
    fetchImpl: context.fetchImpl,
  });

  sendBody(res, upstream.statusCode, upstream.body, {
    "content-type": upstream.contentType || textHeaders["content-type"],
  });
}
