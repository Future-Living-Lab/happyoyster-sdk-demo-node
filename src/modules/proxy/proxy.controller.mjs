import { sendBody, textHeaders } from "../../lib/http.mjs";
import { readRequestBody } from "../../lib/request-body.mjs";
import { callBailianApp } from "../providers/bailian-app.provider.mjs";

export async function handleProxy(req, res, context) {
  const body = await readRequestBody(req);
  const proxyRequest = {
    method: req.method,
    path: context.upstreamPath,
    search: context.url.search,
    headers: req.headers,
    body,
  };

  const upstream = await callBailianApp(proxyRequest, context);
  sendBody(res, upstream.statusCode, upstream.body, {
    "content-type": upstream.contentType || textHeaders["content-type"],
  });
}
