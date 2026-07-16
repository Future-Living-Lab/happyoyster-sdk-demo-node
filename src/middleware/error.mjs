import { sendJson } from "../lib/http.mjs";
import { UpstreamRequestError } from "../lib/upstream-client.mjs";

function toErrorPayload(error) {
  if (error instanceof UpstreamRequestError) {
    return {
      statusCode: 502,
      body: {
        success: false,
        errorCode: "UPSTREAM_ERROR",
        message: "Upstream OpenAPI request failed",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      errorCode: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  };
}

export function withErrorHandling(handler, logger = console) {
  return async function handleWithErrorBoundary(req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      logger?.error?.(error);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const payload = toErrorPayload(error);
      sendJson(res, payload.statusCode, payload.body);
    }
  };
}
