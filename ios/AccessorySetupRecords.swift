import AccessorySetupKit
import ExpoModulesCore

struct PickerOptions: Record {
  @Field var serviceUUID: String?
  @Field var companyIdentifier: Int?
  @Field var nameSubstring: String?
  @Field var displayName: String = ""
  @Field var productImageUri: String = ""
  @Field var range: String = "default"
}

struct PairedAccessoryRecord: Record {
  @Field var id: String = ""
  @Field var bleIdentifier: String = ""
  @Field var displayName: String = ""
  @Field var platform: String = "ios"
}

@available(iOS 18.0, *)
extension PairedAccessoryRecord {
  /// `nil` for accessories without a Bluetooth identity (Wi-Fi only), which this module doesn't expose.
  init?(_ accessory: ASAccessory) {
    guard let identifier = accessory.bluetoothIdentifier?.uuidString else {
      return nil
    }
    self.init()
    id = identifier
    bleIdentifier = identifier
    displayName = accessory.displayName
  }
}
