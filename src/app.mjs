import { loadEnv } from "./config/env.mjs";
import { withErrorHandling } from "./middleware/error.mjs";
import { withRequestLog } from "./middleware/request-log.mjs";
import { createRouter } from "./routes/index.mjs";

export function createRequestHandler({
  config = loadEnv(),
  fetchImpl = fetch,
  logger = console,
} = {}) {
  const router = createRouter({ config, fetchImpl });
  return withRequestLog(withErrorHandling(router, logger), logger);
}
