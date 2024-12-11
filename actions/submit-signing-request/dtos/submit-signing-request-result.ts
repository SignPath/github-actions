export interface SubmitSigningRequestResult {
    signingRequestId: string;
    validationResult: ValidationResult;
    signingRequestUrl: string;
    error: string;
    logs: LogEntry[];
}

export interface ValidationResult {
    errors: ValidationError[];
}

export interface ValidationError {
    error: string;
    howToFix: string;
}

export interface LogEntry {
    message: string;
    level: string;
}

export const LogLevelDebug = "Debug";
export const LogLevelInformation = "Information";
export const LogLevelWarning = "Warning";
export const LogLevelError = "Error";
