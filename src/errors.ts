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

/**
 * Expo wraps the module's exception in a function call exception, so the module's reason is the
 * first cause: `Calling 'x' failed (at …)\n→ Caused by: AccessorySetupException: <reason> (at File.swift:22)`.
 * Debug iOS builds add the exception name and Swift source location, which are stripped here.
 */
function nativeReason(message: string): string {
  const [, reason] = message.split('\n→ Caused by: ');
  if (reason === undefined) {
    return message;
  }
  return reason.replace(/^\w+Exception: /, '').replace(/ \(at [^()]*\)$/, '');
}

/** Native modules reject with `{ code, message }`. Anything unrecognized becomes `UNKNOWN`. */
export function toAccessorySetupError(error: unknown): AccessorySetupError {
  if (error instanceof AccessorySetupError) {
    return error;
  }
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return new AccessorySetupError(
    isErrorCode(code) ? code : 'UNKNOWN',
    typeof message === 'string' ? nativeReason(message) : String(error),
    { cause: error }
  );
}
