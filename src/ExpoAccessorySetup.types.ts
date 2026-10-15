export type AccessoryPlatform = 'ios' | 'android';

export type PairedAccessory = {
  /**
   * Stable identifier for `removeAccessory()` and for matching events.
   * Equal to `bleIdentifier` for Bluetooth accessories.
   */
  id: string;
  /**
   * Pass this to react-native-ble-plx (`connectToDevice`, `devices`, ...).
   * iOS: the CoreBluetooth peripheral UUID. Android: the MAC address, upper case.
   */
  bleIdentifier: string;
  displayName: string;
  platform: AccessoryPlatform;
};

export type AccessoryFilter = {
  /**
   * 16-bit (`"180D"`), 32-bit, or 128-bit Bluetooth service UUID.
   * Must also be listed in the config plugin's `ios.bluetoothServices`.
   */
  serviceUUID?: string;
  /**
   * Bluetooth SIG company identifier, 0 to 0xFFFF.
   * Must also be listed in the config plugin's `ios.bluetoothCompanyIdentifiers`.
   */
  companyIdentifier?: number;
  /**
   * Matches accessories whose advertised name contains this string.
   * Must also be listed in the config plugin's `ios.bluetoothNames`.
   */
  nameSubstring?: string;
};

export type ImageSource = number | { uri: string };

export type IosPickerOptions = {
  /** Product name shown in the system picker. */
  displayName: string;
  /** Product image shown in the system picker: `require('./accessory.png')` or `{ uri }`. */
  productImage: ImageSource;
  /** `immediate` only discovers accessories held close to the device. Defaults to `default`. */
  range?: 'default' | 'immediate';
};

export type AndroidPickerOptions = {
  /** Stop scanning at the first match and show a single-device confirmation. Defaults to `true`. */
  singleDevice?: boolean;
  /** Java regex matched against the advertised name. Replaces `filter.nameSubstring` on Android. */
  namePattern?: string;
};

export type ShowPickerOptions = {
  /** Requires `serviceUUID` or `companyIdentifier`. */
  filter: AccessoryFilter;
  ios: IosPickerOptions;
  android?: AndroidPickerOptions;
};

export type AccessoryEventType = 'accessoryAdded' | 'accessoryRemoved' | 'accessoryChanged';

export type AccessoryEvent = {
  accessory: PairedAccessory;
};

export type AccessorySubscription = {
  remove(): void;
};
