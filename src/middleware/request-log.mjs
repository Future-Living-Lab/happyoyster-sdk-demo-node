export function withRequestLog(handler, logger = console) {
  return async function handleWithRequestLog(req, res) {
    const startedAt = performance.now();

    res.once("finish", () => {
      const latencyMs = Math.round(performance.now() - startedAt);
      logger?.info?.(`${req.method} ${req.url} ${res.statusCode} ${latencyMs}ms`);
    });

    await handler(req, res);
  };
}
