# Changelog

## Unpublished

### 🛠 Breaking changes

### 🎉 New features

### 🐛 Bug fixes

### 💡 Others

## 0.1.1

### 🐛 Bug fixes

- On iOS, `isSupported()` returns `false` and every call rejects with `UNSUPPORTED` when Info.plist doesn't declare `Bluetooth` in `NSAccessorySetupKitSupports`, instead of AccessorySetupKit terminating the app in `ASAccessorySession.init`. This happens when the native project was generated without the config plugin; run `expo prebuild --clean` and rebuild.

## 0.1.0

### 🎉 New features

- `showPicker()` presents the system pairing UI: AccessorySetupKit on iOS 18+, CompanionDeviceManager on Android.
- `getPairedAccessories()` and `removeAccessory()` list and remove the accessories the app has paired.
- `addAccessoryListener()` reports `accessoryAdded`, `accessoryRemoved`, and `accessoryChanged` events.
- `isSupported()` reports whether the device and build can use the module.
- Typed `AccessorySetupError` rejections with `UNSUPPORTED`, `USER_CANCELLED`, `PERMISSION_DENIED`, `ALREADY_IN_PROGRESS`, `NOT_FOUND`, `DISCOVERY_TIMEOUT`, `INVALID_OPTIONS`, and `UNKNOWN` codes.
- Config plugin that writes the AccessorySetupKit Info.plist keys on iOS, and the companion device feature and Bluetooth permissions on Android.
- iOS picker filters are checked against Info.plist and reject with `INVALID_OPTIONS` instead of letting AccessorySetupKit terminate the app.
