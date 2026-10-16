import AccessorySetupKit
import ExpoModulesCore

enum AccessorySetupErrorCode: String {
  case unsupported = "UNSUPPORTED"
  case userCancelled = "USER_CANCELLED"
  case permissionDenied = "PERMISSION_DENIED"
  case alreadyInProgress = "ALREADY_IN_PROGRESS"
  case notFound = "NOT_FOUND"
  case discoveryTimeout = "DISCOVERY_TIMEOUT"
  case invalidOptions = "INVALID_OPTIONS"
  case unknown = "UNKNOWN"
}

final class AccessorySetupException: Exception, @unchecked Sendable {
  private let errorCode: AccessorySetupErrorCode
  private let detail: String

  init(_ code: AccessorySetupErrorCode, _ message: String, cause: Error? = nil) {
    self.errorCode = code
    self.detail = message
    super.init()
    self.cause = cause
  }

  override var code: String {
    errorCode.rawValue
  }

  override var reason: String {
    detail
  }

  @available(iOS 18.0, *)
  static func from(_ error: Error) -> AccessorySetupException {
    if let error = error as? AccessorySetupException {
      return error
    }
    let code: AccessorySetupErrorCode =
      switch (error as? ASError)?.code {
      case .userCancelled: .userCancelled
      case .pickerAlreadyActive: .alreadyInProgress
      case .pickerRestricted, .userRestricted: .permissionDenied
      case .discoveryTimeout: .discoveryTimeout
      case .invalidRequest: .invalidOptions
      default: .unknown
      }
    return AccessorySetupException(code, error.localizedDescription, cause: error)
  }
}
