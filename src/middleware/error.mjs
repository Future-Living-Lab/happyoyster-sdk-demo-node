import { GatewayError } from "../lib/gateway-error.mjs";
import { sendGatewayError } from "../lib/http.mjs";
import { UpstreamRequestError } from "../lib/upstream-client.mjs";

function toErrorPayload(error) {
  if (error instanceof GatewayError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data,
    };
  }

  if (error instanceof UpstreamRequestError) {
    return {
      code: "UPSTREAM_ERROR",
      message: "Upstream OpenAPI request failed",
      data: {},
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    data: {},
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
      sendGatewayError(res, payload.code, payload.message, payload.data);
    }
  };
}
