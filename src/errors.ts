export const AccessorySetupErrorCodes = [
  'UNSUPPORTED',
  'USER_CANCELLED',
  'PERMISSION_DENIED',
  'ALREADY_IN_PROGRESS',
  'NOT_FOUND',
  'DISCOVERY_TIMEOUT',
  'INVALID_OPTIONS',
  'UNKNOWN',
] as const;

export type AccessorySetupErrorCode = (typeof AccessorySetupErrorCodes)[number];

export class AccessorySetupError extends Error {
  readonly code: AccessorySetupErrorCode;

  constructor(code: AccessorySetupErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AccessorySetupError';
    this.code = code;
  }
}

export function isAccessorySetupError(
  error: unknown,
  code?: AccessorySetupErrorCode
): error is AccessorySetupError {
  return error instanceof AccessorySetupError && (code === undefined || error.code === code);
}

function isErrorCode(value: unknown): value is AccessorySetupErrorCode {
  return (AccessorySetupErrorCodes as readonly unknown[]).includes(value);
}

/** Native modules reject with `{ code, message }`. Anything unrecognized becomes `UNKNOWN`. */
export function toAccessorySetupError(error: unknown): AccessorySetupError {
  if (error instanceof AccessorySetupError) {
    return error;
  }
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return new AccessorySetupError(
    isErrorCode(code) ? code : 'UNKNOWN',
    typeof message === 'string' ? message : String(error),
    { cause: error }
  );
}
