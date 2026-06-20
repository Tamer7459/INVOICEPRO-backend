export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = "Unauthorized") {
    super(msg, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = "Forbidden") {
    super(msg, 403);
  }
}

export class ValidationError extends AppError {
  constructor(msg = "Validation failed") {
    super(msg, 400);
  }
}
