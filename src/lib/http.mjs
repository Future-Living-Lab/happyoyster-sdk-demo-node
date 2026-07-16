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

export function methodNotAllowed(res) {
  sendBody(res, 405, "Method Not Allowed\n");
}

export function notFound(res) {
  sendBody(res, 404, "Not Found\n");
}
