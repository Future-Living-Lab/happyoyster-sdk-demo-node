export class GatewayError extends Error {
  constructor(code, message, data = {}) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.data = data;
  }
}
