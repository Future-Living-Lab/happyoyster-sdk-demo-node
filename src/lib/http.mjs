import { randomUUID } from "node:crypto";

const LOCAL_ERROR_SOURCE = "happyoyster-sdk-demo-node";

export const textHeaders = {
  "content-type": "text/plain; charset=utf-8",
};

export function sendBody(res, statusCode, body, headers = textHeaders) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

export function sendJson(res, statusCode, data) {
  sendBody(res, statusCode, `${JSON.stringify(data)}\n`, {
    "content-type": "application/json; charset=utf-8",
  });
}

export function createRequestUrl(req, host, port) {
  const base = `http://${req.headers.host || `${host}:${port}`}`;
  return new URL(req.url || "/", base);
}

export function sendGatewayError(res, code, message, data = {}) {
  sendJson(res, 200, {
    request_id: randomUUID(),
    output: {
      code,
      message: `[${LOCAL_ERROR_SOURCE}] ${message}`,
      data,
    },
  });
}

export function methodNotAllowed(res) {
  sendGatewayError(res, "METHOD_NOT_ALLOWED", "Method Not Allowed");
}

export function notFound(res) {
  sendGatewayError(res, "NOT_FOUND", "Not Found");
}
