package expo.modules.accessorysetup

import expo.modules.kotlin.exception.CodedException

internal enum class AccessorySetupErrorCode {
  UNSUPPORTED,
  USER_CANCELLED,
  PERMISSION_DENIED,
  ALREADY_IN_PROGRESS,
  NOT_FOUND,
  DISCOVERY_TIMEOUT,
  INVALID_OPTIONS,
  UNKNOWN
}

internal class AccessorySetupException(
  code: AccessorySetupErrorCode,
  message: String,
  cause: Throwable? = null
) : CodedException(code.name, message, cause)
