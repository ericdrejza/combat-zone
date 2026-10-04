export class ApiContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractValidationError";
  }
}

