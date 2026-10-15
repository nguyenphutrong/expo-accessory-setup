import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { PairedAccessory } from './ExpoAccessorySetup.types';
import type { NativePickerOptions } from './pickerOptions';

export type ExpoAccessorySetupModuleEvents = {
  onAccessoryAdded: (event: { accessory: PairedAccessory }) => void;
  onAccessoryRemoved: (event: { accessory: PairedAccessory }) => void;
  onAccessoryChanged: (event: { accessory: PairedAccessory }) => void;
};

declare class ExpoAccessorySetupModule extends NativeModule<ExpoAccessorySetupModuleEvents> {
  isSupported(): boolean;
  showPicker(options: NativePickerOptions): Promise<PairedAccessory>;
  getPairedAccessories(): Promise<PairedAccessory[]>;
  removeAccessory(id: string): Promise<void>;
}

/** `null` in Expo Go, on web, and in builds that don't include the module. */
export default requireOptionalNativeModule<ExpoAccessorySetupModule>('ExpoAccessorySetup');
