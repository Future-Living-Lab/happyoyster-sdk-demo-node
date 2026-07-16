export class UpstreamRequestError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "UpstreamRequestError";
    this.cause = cause;
  }
}

export async function fetchUpstream({
  origin,
  path,
  search = "",
  method = "GET",
  headers = {},
  body,
  timeoutMs,
  fetchImpl = fetch,
}) {
  const target = new URL(path, origin);
  target.search = search;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(target, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    return {
      statusCode: response.status,
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    throw new UpstreamRequestError("Upstream request failed", error);
  } finally {
    clearTimeout(timeout);
  }
}
