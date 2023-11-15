export interface SubmitSigningRequestResult {
    signingRequestId: string;
    validationResult: ValidationResult;
    signingRequestUrl: string;
    error: string;
}

export interface ValidationResult {
    errors: ValidationError[];
}

export interface ValidationError {
    error: string;
    howToFix: string;
}