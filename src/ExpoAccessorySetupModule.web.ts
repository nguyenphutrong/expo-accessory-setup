import { registerWebModule, NativeModule } from 'expo';

import { ExpoAccessorySetupModuleEvents } from './ExpoAccessorySetup.types';

// ExpoAccessorySetupModule is not available on the web platform.
class ExpoAccessorySetupModule extends NativeModule<ExpoAccessorySetupModuleEvents> {}

export default registerWebModule(ExpoAccessorySetupModule, 'ExpoAccessorySetupModule');
