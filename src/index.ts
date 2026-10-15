import { Platform } from 'react-native';

import type {
  AccessoryEvent,
  AccessoryEventType,
  AccessorySubscription,
  PairedAccessory,
  ShowPickerOptions,
} from './ExpoAccessorySetup.types';
import NativeModule from './ExpoAccessorySetupModule';
import { AccessorySetupError, toAccessorySetupError } from './errors';
import { toNativePickerOptions } from './pickerOptions';

export * from './ExpoAccessorySetup.types';
export {
  AccessorySetupError,
  AccessorySetupErrorCodes,
  isAccessorySetupError,
  type AccessorySetupErrorCode,
} from './errors';

function requireModule() {
  if (!NativeModule || !NativeModule.isSupported()) {
    throw new AccessorySetupError(
      'UNSUPPORTED',
      NativeModule
        ? 'Accessory setup is not supported on this device (iOS 18+ or Android with companion device setup is required).'
        : 'The ExpoAccessorySetup native module is not available. Use a development build, not Expo Go.'
    );
  }
  return NativeModule;
}

async function call<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } catch (error) {
    throw toAccessorySetupError(error);
  }
}

/** `true` on iOS 18+ and on Android devices with the companion device setup feature. */
export function isSupported(): boolean {
  return NativeModule?.isSupported() ?? false;
}

/**
 * Shows the system accessory picker and resolves with the accessory the user selected.
 * Rejects with `USER_CANCELLED` when the user dismisses the picker and `ALREADY_IN_PROGRESS`
 * when another picker is showing.
 */
export function showPicker(options: ShowPickerOptions): Promise<PairedAccessory> {
  return call(() => {
    const module = requireModule();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    return module.showPicker(toNativePickerOptions(options, platform));
  });
}

export function getPairedAccessories(): Promise<PairedAccessory[]> {
  return call(() => requireModule().getPairedAccessories());
}

/** Rejects with `NOT_FOUND` when no paired accessory has this `id`. */
export function removeAccessory(id: string): Promise<void> {
  return call(() => requireModule().removeAccessory(id));
}

const nativeEventNames = {
  accessoryAdded: 'onAccessoryAdded',
  accessoryRemoved: 'onAccessoryRemoved',
  accessoryChanged: 'onAccessoryChanged',
} as const satisfies Record<AccessoryEventType, string>;

/**
 * On Android, events only fire for changes made through this module. Accessories removed from
 * system settings disappear from the next `getPairedAccessories()` result without an event.
 */
export function addAccessoryListener(
  type: AccessoryEventType,
  listener: (event: AccessoryEvent) => void
): AccessorySubscription {
  if (!NativeModule) {
    return { remove() {} };
  }
  return NativeModule.addListener(nativeEventNames[type], listener);
}
