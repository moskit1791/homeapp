import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  defaultPolishMessageForStatus,
  translateApiDetails,
  translateApiMessage,
} from "./api-error-messages";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{
      originalUrl?: string;
      url?: string;
    }>();
    const error = this.normalizeException(exception);

    response.status(error.statusCode).json({
      code: error.code,
      details: error.details,
      message: error.message,
      path: request.originalUrl ?? request.url,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeException(exception: unknown): NormalizedApiError {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    const databaseError = this.normalizeDatabaseError(exception);

    if (databaseError) {
      return databaseError;
    }

    return {
      code: "INTERNAL_SERVER_ERROR",
      message: translateApiMessage(
        "Internal server error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private normalizeHttpException(exception: HttpException): NormalizedApiError {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (isApiExceptionResponse(response)) {
      return {
        code: response.code,
        details: translateApiDetails(response.details),
        message: translateApiMessage(response.message, statusCode),
        statusCode,
      };
    }

    if (isNestExceptionResponse(response)) {
      return {
        code: this.codeForStatus(statusCode),
        details: Array.isArray(response.message)
          ? response.message.map((message) =>
              translateApiMessage(message, statusCode),
            )
          : undefined,
        message: Array.isArray(response.message)
          ? this.defaultMessageForStatus(statusCode)
          : translateApiMessage(response.message, statusCode),
        statusCode,
      };
    }

    return {
      code: this.codeForStatus(statusCode),
      message: translateApiMessage(
        typeof response === "string" ? response : exception.message,
        statusCode,
      ),
      statusCode,
    };
  }

  private normalizeDatabaseError(
    exception: unknown,
  ): NormalizedApiError | null {
    if (!isRecord(exception) || typeof exception.code !== "string") {
      return null;
    }

    switch (exception.code) {
      case "23505":
        return {
          code: "CONFLICT",
          details: this.databaseConstraintDetails(exception),
          message: translateApiMessage(
            "Resource already exists",
            HttpStatus.CONFLICT,
          ),
          statusCode: HttpStatus.CONFLICT,
        };
      case "23503":
        return {
          code: "INVALID_REFERENCE",
          details: this.databaseConstraintDetails(exception),
          message: translateApiMessage(
            "Referenced resource does not exist",
            HttpStatus.BAD_REQUEST,
          ),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      case "23502":
      case "23514":
      case "22P02":
        return {
          code: "DATABASE_VALIDATION_ERROR",
          details: this.databaseConstraintDetails(exception),
          message: translateApiMessage(
            "Database validation failed",
            HttpStatus.BAD_REQUEST,
          ),
          statusCode: HttpStatus.BAD_REQUEST,
        };
      default:
        return null;
    }
  }

  private databaseConstraintDetails(
    error: Record<string, unknown>,
  ): Record<string, string> {
    const details: Record<string, string> = {};

    if (typeof error.constraint === "string") {
      details.constraint = error.constraint;
    }

    if (typeof error.table === "string") {
      details.table = error.table;
    }

    return details;
  }

  private codeForStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "UNPROCESSABLE_ENTITY";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "TOO_MANY_REQUESTS";
      default:
        return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "HTTP_ERROR";
    }
  }

  private defaultMessageForStatus(statusCode: number): string {
    return (
      defaultPolishMessageForStatus(statusCode) ?? "Zadanie nie powiodlo sie."
    );
  }
}

export interface ApiExceptionResponse {
  code: string;
  details?: unknown;
  message: string;
}

interface NormalizedApiError extends ApiExceptionResponse {
  statusCode: number;
}

interface NestExceptionResponse {
  error?: string;
  message: string | string[];
  statusCode?: number;
}

function isApiExceptionResponse(value: unknown): value is ApiExceptionResponse {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isNestExceptionResponse(
  value: unknown,
): value is NestExceptionResponse {
  return (
    isRecord(value) &&
    (typeof value.message === "string" || Array.isArray(value.message))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
