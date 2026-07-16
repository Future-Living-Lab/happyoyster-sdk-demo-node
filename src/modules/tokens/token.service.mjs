import { fetchUpstream } from "../../lib/upstream-client.mjs";

const EXPIRE_ERROR = "expire_in_seconds must be an integer between 1 and 1800";

export function normalizeExpireInSeconds(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") {
    throw new Error(EXPIRE_ERROR);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1800) {
    throw new Error(EXPIRE_ERROR);
  }
  return parsed;
}

function createTokenSearch(expireInSeconds) {
  if (expireInSeconds === undefined) return "";
  return `?expire_in_seconds=${encodeURIComponent(String(expireInSeconds))}`;
}

export function requestTemporaryApiKey({ expireInSeconds, config, fetchImpl }) {
  return fetchUpstream({
    origin: config.bailianApiOrigin,
    path: "/api/v1/tokens",
    search: createTokenSearch(expireInSeconds),
    method: "POST",
    headers: {
      authorization: `Bearer ${config.dashscopeApiKey}`,
      "user-agent": "happyoyster-sdk-demo-node",
    },
    timeoutMs: config.requestTimeoutMs,
    fetchImpl,
  });
}
