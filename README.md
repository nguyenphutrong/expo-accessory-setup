# expo-accessory-setup

System accessory pairing for Expo apps: [AccessorySetupKit](https://developer.apple.com/documentation/accessorysetupkit) on iOS and [CompanionDeviceManager](https://developer.android.com/develop/connectivity/bluetooth/companion-device-pairing) on Android.

> [!NOTE]
> This is a community package. It is not an official Expo module, and Expo does not maintain or endorse it.

The module shows the system's own pairing UI, lists the accessories your app has paired, and removes them. It hands you a Bluetooth identifier that you pass to [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx) (or any BLE library) to connect and exchange data. It does not connect to accessories itself.

| Platform | System API | Requirement |
| --- | --- | --- |
| iOS | AccessorySetupKit | iOS 18 or later |
| Android | CompanionDeviceManager | Android 8.0 (API 26) or later, with the `android.software.companion_device_setup` feature |

The module needs a [development build](https://docs.expo.dev/develop/development-builds/introduction/). It does not work in Expo Go. It is built and tested with Expo SDK 58.

## Installation

```sh
bunx expo install expo-accessory-setup
```

Add the config plugin to `app.json` and list every identifier your picker filters will use:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-accessory-setup",
        {
          "ios": {
            "bluetoothServices": ["180D"],
            "bluetoothNames": ["Acme"],
            "bluetoothCompanyIdentifiers": [76]
          },
          "android": {
            "runInBackground": false,
            "useDataInBackground": false
          }
        }
      ]
    ]
  }
}
```

Then rebuild the native project:

```sh
bunx expo prebuild --clean
bunx expo run:ios   # or run:android
```

## Config plugin options

All options are optional, except that `ios.bluetoothServices` or `ios.bluetoothCompanyIdentifiers` must contain at least one value. Invalid options fail `expo prebuild` with a message that names the field.

| Option | Type | Effect |
| --- | --- | --- |
| `ios.bluetoothServices` | `string[]` | 16-bit (`"180D"`) or 128-bit service UUIDs. Written to `NSAccessorySetupBluetoothServices`. |
| `ios.bluetoothNames` | `string[]` | Advertised names or name substrings. Written to `NSAccessorySetupBluetoothNames`. |
| `ios.bluetoothCompanyIdentifiers` | `number[]` | Bluetooth SIG company identifiers, 0 to 65535. Written to `NSAccessorySetupBluetoothCompanyIdentifiers` as four hex digits (`76` becomes `"004C"`). |
| `android.runInBackground` | `boolean` | Adds `REQUEST_COMPANION_RUN_IN_BACKGROUND`. |
| `android.useDataInBackground` | `boolean` | Adds `REQUEST_COMPANION_USE_DATA_IN_BACKGROUND`. |

The plugin always writes:

- **iOS:** `NSAccessorySetupKitSupports` with `Bluetooth`, plus each key in the table that has values. Existing `NSAccessorySetupKitSupports` values, such as `WiFi`, are kept. Keys without values are left out, because AccessorySetupKit terminates the app when one of them is present and empty.
- **Android:** `<uses-feature android:name="android.software.companion_device_setup" android:required="false" />`, `BLUETOOTH_CONNECT`, and `BLUETOOTH` and `BLUETOOTH_ADMIN` limited to API 30 and lower. CompanionDeviceManager scans for your app, so the plugin adds no scan or location permission. The feature is not required, so the app still installs on devices without it, and `isSupported()` returns `false` there.

> [!IMPORTANT]
> On iOS, every value that a picker filter uses must appear in Info.plist. AccessorySetupKit terminates the app when a filter uses an undeclared service, name, or company identifier. This module checks the filter against Info.plist first and rejects with `INVALID_OPTIONS` instead.

## Usage

```tsx
import {
  addAccessoryListener,
  getPairedAccessories,
  isAccessorySetupError,
  isSupported,
  removeAccessory,
  showPicker,
} from 'expo-accessory-setup';
import { BleManager } from 'react-native-ble-plx';

if (isSupported()) {
  try {
    const accessory = await showPicker({
      filter: { serviceUUID: '180D' },
      ios: {
        displayName: 'Acme Heart Rate Strap',
        productImage: require('./assets/strap.png'),
      },
      android: { singleDevice: true },
    });

    const device = await new BleManager().connectToDevice(accessory.bleIdentifier);
  } catch (error) {
    if (isAccessorySetupError(error, 'USER_CANCELLED')) {
      return;
    }
    throw error;
  }
}
```

The [example app](./example/App.tsx) shows the whole flow. It pairs an accessory, lists the paired accessories, connects with react-native-ble-plx, and removes an accessory.

## API

### `isSupported(): boolean`

Returns `true` on iOS 18 or later, and on Android devices with the companion device setup feature on API 26 or later. Returns `false` in Expo Go, on web, and on older systems. When it returns `false`, every other function rejects with `UNSUPPORTED`.

### `showPicker(options: ShowPickerOptions): Promise<PairedAccessory>`

Shows the system picker and resolves with the accessory the user selected.

```ts
type ShowPickerOptions = {
  filter: {
    serviceUUID?: string;        // 16-, 32-, or 128-bit UUID
    companyIdentifier?: number;  // 0 to 0xFFFF
    nameSubstring?: string;
  };
  ios: {
    displayName: string;
    productImage: number | { uri: string }; // require('./image.png') or a URI
    range?: 'default' | 'immediate';        // 'immediate' only finds accessories held close
  };
  android?: {
    singleDevice?: boolean; // default true
    namePattern?: string;   // Java regex. Replaces filter.nameSubstring on Android.
  };
};
```

`filter` must contain `serviceUUID` or `companyIdentifier`. The `ios` section is required because the iOS picker needs a product name and image. You must pass it even if you only target Android.

The promise rejects with:

- `USER_CANCELLED` when the user closes the picker.
- `ALREADY_IN_PROGRESS` when another picker is showing.
- `INVALID_OPTIONS` when an option is malformed, or when an iOS filter value is missing from Info.plist.
- `DISCOVERY_TIMEOUT` when the system finds no matching device and reports a timeout.

### `getPairedAccessories(): Promise<PairedAccessory[]>`

Returns the accessories that this app has paired.

### `removeAccessory(id: string): Promise<void>`

Removes the pairing. Rejects with `NOT_FOUND` when no paired accessory has this `id`.

### `addAccessoryListener(type, listener): { remove(): void }`

`type` is `'accessoryAdded'`, `'accessoryRemoved'`, or `'accessoryChanged'`. The listener receives `{ accessory: PairedAccessory }`. See [Platform differences](#platform-differences) for when each event fires.

### `PairedAccessory`

```ts
type PairedAccessory = {
  id: string;            // pass to removeAccessory()
  bleIdentifier: string; // pass to react-native-ble-plx
  displayName: string;
  platform: 'ios' | 'android';
};
```

| Field | iOS | Android |
| --- | --- | --- |
| `id` | CoreBluetooth peripheral UUID | MAC address, upper case |
| `bleIdentifier` | CoreBluetooth peripheral UUID (`ASAccessory.bluetoothIdentifier`) | MAC address, upper case |
| `displayName` | Name the system shows for the accessory | Name from the association or the scan. Falls back to the MAC address. |

### Errors

Every rejection is an `AccessorySetupError` with a `code` and the native message. Use `isAccessorySetupError(error, code?)` to check for one.

| Code | Meaning |
| --- | --- |
| `UNSUPPORTED` | The device or build can't use this module. See `isSupported()`. |
| `USER_CANCELLED` | The user closed or rejected the picker. |
| `PERMISSION_DENIED` | iOS refused to show the picker: the app is in the background, or the user restricted access. |
| `ALREADY_IN_PROGRESS` | Another picker is showing. |
| `NOT_FOUND` | `removeAccessory()` got an unknown `id`. |
| `DISCOVERY_TIMEOUT` | The system reported a discovery timeout. |
| `INVALID_OPTIONS` | Malformed options, an iOS filter value missing from Info.plist, or an empty `NSAccessorySetupBluetooth*` key in Info.plist. |
| `UNKNOWN` | Any other native error. `error.message` holds the native message, and `error.cause` holds the original error. |

## Using it with react-native-ble-plx

Pass `accessory.bleIdentifier` to `connectToDevice()`. You don't need to scan first:

- **iOS:** ble-plx connects through `retrievePeripherals(withIdentifiers:)`, which finds the peripheral by its UUID.
- **Android:** ble-plx connects by MAC address. On Android 12 (API 31) and later, request the `BLUETOOTH_CONNECT` runtime permission before you connect. The config plugin declares it, but your app must still request it.

### CoreBluetooth changes on iOS

When an app declares AccessorySetupKit support, iOS changes how CoreBluetooth behaves for that app. In [WWDC24 session 10203, "Meet AccessorySetupKit"](https://developer.apple.com/videos/play/wwdc2024/10203/), Apple describes three changes:

- People are not asked for Bluetooth permission.
- `CBCentralManager` only reaches the `poweredOn` state after the app has paired an accessory.
- Scans only return accessories paired with the app.

This affects ble-plx in three ways:

- `BleManager.state()` doesn't report `PoweredOn` until the first accessory is paired. Don't wait for a powered-on state before you show the picker.
- `startDeviceScan()` won't show unpaired devices. Use `showPicker()` for discovery, then use scans only to find accessories you have already paired.
- This affects the whole app. If other parts of your app scan for arbitrary BLE devices, they stop seeing devices that weren't paired through the picker.

## Platform differences

| Behavior | iOS | Android |
| --- | --- | --- |
| Picker UI | Full-screen sheet with your product name and image | System dialog listing matching devices |
| Name filter | `filter.nameSubstring` (substring match) | `filter.nameSubstring`, or `android.namePattern` as a regex |
| `accessoryAdded` | Fires for every accessory paired through the picker | Fires after `showPicker()` resolves |
| `accessoryRemoved` | Fires for removals from the app and from Settings | Fires only for `removeAccessory()`. Removals in system settings show up in the next `getPairedAccessories()` result. |
| `accessoryChanged` | Fires when AccessorySetupKit reports that an accessory's properties changed | Never fires |
| Bluetooth permission prompt | None | `BLUETOOTH_CONNECT` (API 31+), requested by your app before connecting |
| Location | Not needed | No permission needed, but CompanionDeviceManager requires the device's Location Services to be on |

## Limitations

- **Bluetooth LE only.** The module does not cover Wi-Fi accessories, Wi-Fi Aware, or AccessorySetupKit discovery extensions.
- **One display item per picker on iOS.** `showPicker()` presents a single product.
- **No migration of existing pairings on iOS.** Accessories that your app paired through CoreBluetooth before adopting AccessorySetupKit don't appear in `getPairedAccessories()`. AccessorySetupKit supports migration through `ASMigrationDisplayItem`, but this module does not use it.
- **No self-managed or profile-based associations on Android.** Watch, glasses, and other device profiles need extra permissions and roles that the module doesn't request.
- **Audio accessories may not appear in the iOS picker.** On iOS 27, AccessorySetupKit never offered a pair of Sony WH-1000XM6 headphones, even though their advertisement matched the filter. iOS logged no reason. Test with the accessory you target.
- **Picker filters must match the plugin config on iOS.** Changing a filter value requires a native rebuild.
- **Unverified details.** These are assumptions in the current implementation. Each one is marked with `TODO(verify)` in the source:
  - Apple doesn't document the string format for `NSAccessorySetupBluetoothCompanyIdentifiers`. The plugin writes four hex digits (`"004C"`).
  - On Android, `filter.companyIdentifier` becomes a scan filter with empty manufacturer data, which should match any data from that company.

## Troubleshooting

**`UNSUPPORTED` in Expo Go.** Expo Go doesn't include this module. Build a development build with `bunx expo run:ios` or `bunx expo run:android`.

**`INVALID_OPTIONS: filter.serviceUUID … is not listed in NSAccessorySetupBluetoothServices`.** Add the value to the plugin's `ios.bluetoothServices`, run `bunx expo prebuild --clean`, and rebuild the app.

**`UNKNOWN: The accessory session was invalidated` in the iOS Simulator.** The Simulator has no Bluetooth, so AccessorySetupKit invalidates the session. Test the picker on a physical iPhone.

**`INVALID_OPTIONS: Info.plist key … has no values`.** An `NSAccessorySetupBluetooth*` key is present with an empty array, which makes AccessorySetupKit terminate the app. Remove the key, or let the config plugin write Info.plist with `bunx expo prebuild --clean`.

**The iOS picker shows no devices.** Check that the accessory advertises the filtered service UUID or company identifier. Some accessories, such as Bluetooth headphones, don't appear even when they match. See [Limitations](#limitations). With `range: 'immediate'`, hold the device next to the accessory.

**`PERMISSION_DENIED` on iOS.** The picker only shows while the app is in the foreground. Call `showPicker()` from a user action, such as a button press.

**The Android dialog never finds the device.** Turn on Location Services. CompanionDeviceManager requires them even though your app needs no location permission. Also make sure your app isn't running its own Bluetooth scan at the same time.

**ble-plx can't connect on Android.** Request `PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT` first on Android 12 and later.

**ble-plx never reports `PoweredOn` on iOS.** This is expected before the first accessory is paired. See [CoreBluetooth changes on iOS](#corebluetooth-changes-on-ios).

## Contributing

```sh
bun install
bun run test        # Jest: TypeScript API and config plugin
bun run lint
bun run build       # TypeScript API
bun run build plugin  # config plugin, used by the example's prebuild
cd example && bunx expo run:ios
```

The iOS Simulator can't show the picker. Test pairing on a physical device.

## License

MIT
