export type ValidationSeverity = "info" | "warning" | "error";
export type ValidationMode = "OFF" | "ADVISORY" | "ASSISTED" | "STRICT";

export type ValidationMessage = {
  code: string;
  message: string;
  severity: ValidationSeverity;
};

export type ValidationResult = {
  valid: boolean;
  messages: ValidationMessage[];
};
