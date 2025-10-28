import { Request, Response, NextFunction } from 'express';
import { logError } from './requestLogger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = (err as AppError).statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const isOperational = (err as AppError).isOperational || false;

  // Log error
  logError({
    service: 'api',
    endpoint: req.path,
    requestId: (req as any).requestId,
    message: `Error: ${message}`,
    error: {
      stack: err.stack,
      statusCode,
      isOperational
    }
  });

  // Don't leak error details in production
  const response: any = {
    error: message,
    statusCode
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
