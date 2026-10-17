import AccessorySetupKit
import CoreBluetooth
import UIKit

enum AccessoryEventName: String {
  case added = "onAccessoryAdded"
  case removed = "onAccessoryRemoved"
  case changed = "onAccessoryChanged"
}

/// Owns the app's single `ASAccessorySession`. All state lives on the main actor, which is also
/// the queue the session delivers events on.
@available(iOS 18.0, *)
@MainActor
final class AccessorySessionController {
  private enum Activation {
    case inactive
    case activating([CheckedContinuation<Void, Error>])
    case active
  }

  private final class PresentedPicker {
    let continuation: CheckedContinuation<ASAccessory, Error>
    var pickedAccessory: ASAccessory?
    var setupError: Error?

    init(_ continuation: CheckedContinuation<ASAccessory, Error>) {
      self.continuation = continuation
    }
  }

  private enum PickerState {
    case idle
    /// Reserved synchronously so concurrent calls are rejected across the awaits that follow.
    case preparing
    case presented(PresentedPicker)
  }

  private var session = ASAccessorySession()
  private var activation = Activation.inactive
  private var picker = PickerState.idle
  private let emit: (AccessoryEventName, PairedAccessoryRecord) -> Void

  init(emit: @escaping (AccessoryEventName, PairedAccessoryRecord) -> Void) {
    self.emit = emit
  }

  /// `ASAccessorySession()` terminates the app when an `NSAccessorySetupBluetooth*` key is present
  /// with no values, so this rejects that Info.plist before a session is created.
  static func validateInfoPlist() throws {
    let info = Bundle.main.infoDictionary ?? [:]
    let keys = [
      "NSAccessorySetupBluetoothServices", "NSAccessorySetupBluetoothNames",
      "NSAccessorySetupBluetoothCompanyIdentifiers",
    ]
    for key in keys {
      if let values = info[key] as? [Any], values.isEmpty {
        throw AccessorySetupException(
          .invalidOptions,
          "Info.plist key \(key) has no values. Remove the key, or rebuild with the config plugin, which leaves out unused keys."
        )
      }
    }
  }

  func invalidate() {
    session.invalidate()
  }

  func pairedAccessories() async throws -> [PairedAccessoryRecord] {
    try await activate()
    return session.accessories.compactMap(PairedAccessoryRecord.init)
  }

  func removeAccessory(id: String) async throws {
    try await activate()
    guard
      let accessory = session.accessories.first(where: {
        $0.bluetoothIdentifier?.uuidString.caseInsensitiveCompare(id) == .orderedSame
      })
    else {
      throw AccessorySetupException(.notFound, "No paired accessory has the id \(id).")
    }
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      session.removeAccessory(accessory) { error in
        if let error {
          continuation.resume(throwing: AccessorySetupException.from(error))
        } else {
          continuation.resume()
        }
      }
    }
  }

  func showPicker(_ options: PickerOptions) async throws -> PairedAccessoryRecord {
    guard case .idle = picker else {
      throw AccessorySetupException(.alreadyInProgress, "Another accessory picker is already showing.")
    }
    picker = .preparing
    defer {
      picker = .idle
    }

    let descriptor = try Self.makeDescriptor(options)
    let image = try await Self.loadProductImage(options.productImageUri)
    try await activate()
    let item = ASPickerDisplayItem(name: options.displayName, productImage: image, descriptor: descriptor)

    let accessory = try await withCheckedThrowingContinuation { continuation in
      picker = .presented(PresentedPicker(continuation))
      session.showPicker(for: [item]) { [weak self] error in
        guard let error else {
          return
        }
        Task { @MainActor in
          self?.finishPicker(.failure(AccessorySetupException.from(error)))
        }
      }
    }
    guard let record = PairedAccessoryRecord(accessory) else {
      throw AccessorySetupException(.unknown, "The picked accessory has no Bluetooth identifier.")
    }
    return record
  }

  // MARK: - Session lifecycle

  private func activate() async throws {
    switch activation {
    case .active:
      return
    case .activating:
      try await withCheckedThrowingContinuation { continuation in
        if case .activating(let waiters) = activation {
          activation = .activating(waiters + [continuation])
        } else {
          continuation.resume()
        }
      }
    case .inactive:
      try await withCheckedThrowingContinuation { continuation in
        activation = .activating([continuation])
        session.activate(on: .main) { [weak self] event in
          MainActor.assumeIsolated {
            self?.handle(event)
          }
        }
      }
    }
  }

  private func finishActivation(_ result: Result<Void, Error>) {
    guard case .activating(let waiters) = activation else {
      return
    }
    activation = if case .success = result { .active } else { .inactive }
    waiters.forEach { $0.resume(with: result) }
  }

  private func handle(_ event: ASAccessoryEvent) {
    switch event.eventType {
    case .activated:
      finishActivation(.success(()))
    case .invalidated:
      let reason = event.error.map { " \($0.localizedDescription)" } ?? ""
      let error = AccessorySetupException(.unknown, "The accessory session was invalidated.\(reason)", cause: event.error)
      finishActivation(.failure(error))
      finishPicker(.failure(error))
      // An invalidated session can't be activated again.
      session = ASAccessorySession()
      activation = .inactive
    case .accessoryAdded:
      if case .presented(let presented) = picker {
        presented.pickedAccessory = event.accessory
      }
      emitEvent(.added, event.accessory)
    case .accessoryRemoved:
      emitEvent(.removed, event.accessory)
    case .accessoryChanged:
      emitEvent(.changed, event.accessory)
    case .pickerSetupFailed:
      if case .presented(let presented) = picker {
        presented.setupError = event.error
      }
    case .pickerDidDismiss:
      // Apple delivers accessoryAdded before pickerDidDismiss, so the pick is known by now.
      guard case .presented(let presented) = picker else {
        return
      }
      if let accessory = presented.pickedAccessory {
        finishPicker(.success(accessory))
      } else if let error = presented.setupError {
        finishPicker(.failure(AccessorySetupException.from(error)))
      } else {
        finishPicker(.failure(AccessorySetupException(.userCancelled, "The user dismissed the accessory picker.")))
      }
    default:
      break
    }
  }

  private func finishPicker(_ result: Result<ASAccessory, Error>) {
    guard case .presented(let presented) = picker else {
      return
    }
    // Back to `.preparing` until showPicker's `defer` runs; a new call must not start before then.
    picker = .preparing
    presented.continuation.resume(with: result)
  }

  private func emitEvent(_ name: AccessoryEventName, _ accessory: ASAccessory?) {
    if let accessory, let record = PairedAccessoryRecord(accessory) {
      emit(name, record)
    }
  }

  // MARK: - Picker inputs

  /// Apple terminates the app when a descriptor uses a service, name, or company identifier
  /// missing from Info.plist, so this rejects those filters first.
  private static func makeDescriptor(_ options: PickerOptions) throws -> ASDiscoveryDescriptor {
    let info = Bundle.main.infoDictionary ?? [:]
    func declared(_ key: String) -> [String] {
      info[key] as? [String] ?? []
    }
    func missing(_ field: String, _ value: String, _ key: String, _ pluginOption: String) -> AccessorySetupException {
      AccessorySetupException(
        .invalidOptions,
        "\(field) \(value) is not listed in \(key). Add it to the config plugin's ios.\(pluginOption) and rebuild."
      )
    }

    let descriptor = ASDiscoveryDescriptor()
    if let serviceUUID = options.serviceUUID {
      let services = declared("NSAccessorySetupBluetoothServices").map(expandedUUID)
      guard services.contains(expandedUUID(serviceUUID)) else {
        throw missing("filter.serviceUUID", serviceUUID, "NSAccessorySetupBluetoothServices", "bluetoothServices")
      }
      descriptor.bluetoothServiceUUID = CBUUID(string: serviceUUID)
    }
    if let companyIdentifier = options.companyIdentifier {
      let companies = declared("NSAccessorySetupBluetoothCompanyIdentifiers").compactMap(parseCompanyIdentifier)
      guard let identifier = UInt16(exactly: companyIdentifier), companies.contains(identifier) else {
        throw missing(
          "filter.companyIdentifier", String(companyIdentifier), "NSAccessorySetupBluetoothCompanyIdentifiers",
          "bluetoothCompanyIdentifiers")
      }
      descriptor.bluetoothCompanyIdentifier = ASBluetoothCompanyIdentifier(rawValue: identifier)
    }
    if let nameSubstring = options.nameSubstring {
      guard declared("NSAccessorySetupBluetoothNames").contains(nameSubstring) else {
        throw missing("filter.nameSubstring", nameSubstring, "NSAccessorySetupBluetoothNames", "bluetoothNames")
      }
      descriptor.bluetoothNameSubstring = nameSubstring
    }
    descriptor.bluetoothRange = options.range == "immediate" ? .immediate : .default
    return descriptor
  }

  private static func expandedUUID(_ uuid: String) -> String {
    let uuid = uuid.uppercased()
    switch uuid.count {
    case 4: return "0000\(uuid)-0000-1000-8000-00805F9B34FB"
    case 8: return "\(uuid)-0000-1000-8000-00805F9B34FB"
    default: return uuid
    }
  }

  private static func parseCompanyIdentifier(_ value: String) -> UInt16? {
    let hex = value.lowercased().hasPrefix("0x") ? String(value.dropFirst(2)) : value
    return UInt16(hex, radix: 16)
  }

  /// Loads `file://` URIs from release bundles and `http://` URIs served by Metro in development.
  private static func loadProductImage(_ uri: String) async throws -> UIImage {
    guard let url = URL(string: uri) else {
      throw AccessorySetupException(.invalidOptions, "ios.productImage URI \(uri) is not a valid URL.")
    }
    do {
      let (data, _) = try await URLSession.shared.data(from: url)
      if let image = UIImage(data: data) {
        return image
      }
    } catch {
      throw AccessorySetupException(
        .invalidOptions, "ios.productImage could not be loaded from \(uri): \(error.localizedDescription)", cause: error)
    }
    throw AccessorySetupException(.invalidOptions, "ios.productImage at \(uri) is not a supported image.")
  }
}
