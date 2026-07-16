export async function readRequestBody(req) {
  if (req.method !== "POST") return undefined;

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}
