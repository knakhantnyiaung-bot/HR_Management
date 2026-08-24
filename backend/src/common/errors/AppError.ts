export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(code: string, message: string) {
    return new AppError(400, code, message);
  }

  static unauthorized(message = "Authentication required") {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(resource: string) {
    return new AppError(404, "NOT_FOUND", `${resource} not found`);
  }

  static conflict(code: string, message: string) {
    return new AppError(409, code, message);
  }

  static businessRule(code: string, message: string) {
    return new AppError(422, code, message);
  }
}
