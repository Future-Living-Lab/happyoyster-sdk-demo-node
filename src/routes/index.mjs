import { createRequestUrl, methodNotAllowed, notFound } from "../lib/http.mjs";
import { handleProxy } from "../modules/proxy/proxy.controller.mjs";
import { handleTemporaryApiKey } from "../modules/tokens/token.controller.mjs";

const SERVER_API_ROUTES = new Map([
  ["GET /server-api/worlds", "/openapi/v1/worlds"],
  ["POST /server-api/worlds", "/openapi/v1/worlds"],
  ["GET /server-api/worlds/build-status", "/openapi/v1/worlds/build-status"],
  ["GET /server-api/worlds/detail", "/openapi/v1/worlds/detail"],
  ["POST /server-api/worlds/delete", "/openapi/v1/worlds/delete"],
  [
    "POST /server-api/travel-credential",
    "/openapi/v1/worlds/get-travel-credential",
  ],
  ["GET /server-api/travels", "/openapi/v1/travels"],
  ["GET /server-api/travels/artifacts", "/openapi/v1/travels/artifacts"],
  ["POST /server-api/travels/update-script", "/openapi/v1/travels/update-script"],
]);

const SERVER_API_PATHS = new Set([
  ...Array.from(SERVER_API_ROUTES.keys(), (route) => route.split(" ")[1]),
  "/server-api/temp-api-key",
]);

function resolveServerApiRoute(method, pathname) {
  return SERVER_API_ROUTES.get(`${method} ${pathname}`);
}

export function createRouter({ config, fetchImpl = fetch }) {
  return async function routeRequest(req, res) {
    const url = createRequestUrl(req, config.host, config.port);
    const upstreamPath = resolveServerApiRoute(req.method, url.pathname);

    if (req.method === "POST" && url.pathname === "/server-api/temp-api-key") {
      await handleTemporaryApiKey(req, res, { config, fetchImpl, url });
      return;
    }

    if (upstreamPath) {
      await handleProxy(req, res, { config, fetchImpl, url, upstreamPath });
      return;
    }

    if (SERVER_API_PATHS.has(url.pathname)) {
      methodNotAllowed(res);
      return;
    }

    notFound(res);
  };
}
