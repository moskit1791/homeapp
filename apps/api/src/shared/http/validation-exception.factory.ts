import { BadRequestException } from "@nestjs/common";
import { ValidationError } from "class-validator";
import { translateValidationMessage } from "./api-error-messages";

export function createValidationException(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: "VALIDATION_ERROR",
    details: flattenValidationErrors(errors),
    message: "Dane są nieprawidłowe.",
  });
}

export interface ValidationErrorDetail {
  field: string;
  messages: string[];
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const messages = Object.values(error.constraints ?? {}).map((message) =>
      translateValidationMessage(message, field),
    );

    if (messages.length > 0) {
      details.push({ field, messages });
    }

    if (error.children && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}
