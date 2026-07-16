import { createServer } from "node:http";
import { createRequestHandler } from "./app.mjs";
import { loadEnv } from "./config/env.mjs";

export function startServer({ config = loadEnv(), logger = console } = {}) {
  const server = createServer(createRequestHandler({ config, logger }));

  server.listen(config.port, config.host, () => {
    logger.info(
      `Happy Oyster demo server listening on http://${config.host}:${config.port}/server-api`,
    );
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
    });
  }

  return server;
}
