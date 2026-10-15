// Reexport the native module. On web, it will be resolved to ExpoAccessorySetupModule.web.ts
// and on native platforms to ExpoAccessorySetupModule.ts
export { default } from './ExpoAccessorySetupModule';
export * from './ExpoAccessorySetup.types';
