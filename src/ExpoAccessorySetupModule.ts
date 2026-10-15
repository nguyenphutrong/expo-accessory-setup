import { NativeModule, requireNativeModule } from 'expo';

import { ExpoAccessorySetupModuleEvents } from './ExpoAccessorySetup.types';

declare class ExpoAccessorySetupModule extends NativeModule<ExpoAccessorySetupModuleEvents> {
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<ExpoAccessorySetupModule>('ExpoAccessorySetup');
