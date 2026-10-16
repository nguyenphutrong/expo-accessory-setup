import ExpoModulesCore

// Sendable because its only mutable state, `sessionController`, is isolated to the main actor.
public final class ExpoAccessorySetupModule: Module, @unchecked Sendable {
  /// An `AccessorySessionController` on iOS 18+. Typed as `AnyObject` so the module loads on older iOS.
  @MainActor private var sessionController: AnyObject?

  public func definition() -> ModuleDefinition {
    Name("ExpoAccessorySetup")

    Events(AccessoryEventName.added.rawValue, AccessoryEventName.removed.rawValue, AccessoryEventName.changed.rawValue)

    Function("isSupported") { () -> Bool in
      if #available(iOS 18.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("showPicker") { (options: PickerOptions) async throws -> PairedAccessoryRecord in
      guard #available(iOS 18.0, *) else {
        throw Self.unsupported()
      }
      return try await self.controller().showPicker(options)
    }

    AsyncFunction("getPairedAccessories") { () async throws -> [PairedAccessoryRecord] in
      guard #available(iOS 18.0, *) else {
        throw Self.unsupported()
      }
      return try await self.controller().pairedAccessories()
    }

    AsyncFunction("removeAccessory") { (id: String) async throws in
      guard #available(iOS 18.0, *) else {
        throw Self.unsupported()
      }
      return try await self.controller().removeAccessory(id: id)
    }

    OnDestroy {
      Task { @MainActor in
        if #available(iOS 18.0, *) {
          (self.sessionController as? AccessorySessionController)?.invalidate()
        }
      }
    }
  }

  private static func unsupported() -> AccessorySetupException {
    AccessorySetupException(.unsupported, "AccessorySetupKit requires iOS 18 or later.")
  }

  @available(iOS 18.0, *)
  @MainActor
  private func controller() throws -> AccessorySessionController {
    if let controller = sessionController as? AccessorySessionController {
      return controller
    }
    try AccessorySessionController.validateInfoPlist()
    let controller = AccessorySessionController { [weak self] name, accessory in
      self?.sendEvent(name.rawValue, ["accessory": accessory.toDictionary()])
    }
    sessionController = controller
    return controller
  }
}
