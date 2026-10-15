import {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
  type ConfigPlugin,
  type InfoPlist,
} from '@expo/config-plugins';

import {
  parseOptions,
  type AccessorySetupOptions,
  type AccessorySetupPluginProps,
} from './options';

const pkg = require('../../package.json');

export type { AccessorySetupPluginProps } from './options';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;

export function setAccessorySetupInfoPlist(
  infoPlist: InfoPlist,
  { ios }: AccessorySetupOptions
): InfoPlist {
  const supports = Array.isArray(infoPlist.NSAccessorySetupKitSupports)
    ? (infoPlist.NSAccessorySetupKitSupports as string[])
    : [];
  return {
    ...infoPlist,
    NSAccessorySetupKitSupports: supports.includes('Bluetooth')
      ? supports
      : [...supports, 'Bluetooth'],
    // Apple asks for all three keys whenever NSAccessorySetupKitSupports contains Bluetooth.
    // TODO(verify): that an empty array is accepted for an unused key.
    NSAccessorySetupBluetoothServices: ios.bluetoothServices,
    NSAccessorySetupBluetoothNames: ios.bluetoothNames,
    // TODO(verify): Apple documents these as "two-byte UUID" strings without a format example.
    // Four hex digits ("004C") is the assumed format.
    NSAccessorySetupBluetoothCompanyIdentifiers: ios.bluetoothCompanyIdentifiers,
  };
}

const COMPANION_DEVICE_SETUP_FEATURE = 'android.software.companion_device_setup';

function ensureUsesFeature(manifest: AndroidManifest, name: string) {
  manifest.manifest['uses-feature'] ??= [];
  const features = manifest.manifest['uses-feature'];
  if (!features.some((feature) => feature.$['android:name'] === name)) {
    // Not required, so the app still installs where isSupported() returns false.
    features.push({ $: { 'android:name': name, 'android:required': 'false' } });
  }
}

function ensureLegacyPermission(manifest: AndroidManifest, name: string) {
  manifest.manifest['uses-permission'] ??= [];
  const permissions = manifest.manifest['uses-permission'];
  if (!permissions.some((permission) => permission.$['android:name'] === name)) {
    const permission = { $: { 'android:name': name, 'android:maxSdkVersion': '30' } };
    permissions.push(permission);
  }
}

export function setAccessorySetupManifest(
  manifest: AndroidManifest,
  { android }: AccessorySetupOptions
): AndroidManifest {
  ensureUsesFeature(manifest, COMPANION_DEVICE_SETUP_FEATURE);

  // CompanionDeviceManager scans on the app's behalf, so no scan or location permission is
  // needed. These cover connecting to the paired accessory afterwards (react-native-ble-plx).
  ensureLegacyPermission(manifest, 'android.permission.BLUETOOTH');
  ensureLegacyPermission(manifest, 'android.permission.BLUETOOTH_ADMIN');
  AndroidConfig.Permissions.ensurePermission(manifest, 'android.permission.BLUETOOTH_CONNECT');

  if (android.runInBackground) {
    AndroidConfig.Permissions.ensurePermission(
      manifest,
      'android.permission.REQUEST_COMPANION_RUN_IN_BACKGROUND'
    );
  }
  if (android.useDataInBackground) {
    AndroidConfig.Permissions.ensurePermission(
      manifest,
      'android.permission.REQUEST_COMPANION_USE_DATA_IN_BACKGROUND'
    );
  }
  return manifest;
}

const withAccessorySetup: ConfigPlugin<AccessorySetupPluginProps | void> = (config, props) => {
  const options = parseOptions(props);

  config = withInfoPlist(config, (config) => {
    config.modResults = setAccessorySetupInfoPlist(config.modResults, options);
    return config;
  });

  return withAndroidManifest(config, (config) => {
    config.modResults = setAccessorySetupManifest(config.modResults, options);
    return config;
  });
};

export default createRunOncePlugin(withAccessorySetup, pkg.name, pkg.version);
