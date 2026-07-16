const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function isInternalGatewayHeader(name) {
  return name.startsWith("x-dashscope-") || name.startsWith("x-ho-");
}

export function copyForwardableHeaders(headers) {
  const result = {};

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (value === undefined || value === "") continue;
    if (HOP_BY_HOP_HEADERS.has(lowerName)) continue;
    if (isInternalGatewayHeader(lowerName)) continue;
    result[lowerName] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  return result;
}

export function hasHeader(headers, name) {
  return Object.hasOwn(headers, name.toLowerCase());
}
