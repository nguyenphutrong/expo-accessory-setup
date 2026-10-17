import { AndroidConfig, type ExpoConfig } from '@expo/config-plugins';

import withAccessorySetup, { setAccessorySetupInfoPlist, setAccessorySetupManifest } from '../src';
import { parseOptions } from '../src/options';

type AndroidManifest = AndroidConfig.Manifest.AndroidManifest;

function emptyManifest(): AndroidManifest {
  return {
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      queries: [],
    },
  };
}

const minimal = { ios: { bluetoothServices: ['180D'] } };

describe('parseOptions', () => {
  it('normalizes and de-duplicates values', () => {
    expect(
      parseOptions({
        ios: {
          bluetoothServices: ['180d', '180D', '6e400001-b5a3-f393-e0a9-e50e24dcca9e'],
          bluetoothNames: ['Acme'],
          bluetoothCompanyIdentifiers: [76, 0xffff],
        },
        android: { runInBackground: true },
      })
    ).toEqual({
      ios: {
        bluetoothServices: ['180D', '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'],
        bluetoothNames: ['Acme'],
        bluetoothCompanyIdentifiers: ['004C', 'FFFF'],
      },
      android: { runInBackground: true, useDataInBackground: false },
    });
  });

  it.each<[string, unknown, RegExp]>([
    ['no options', undefined, /ios\.bluetoothServices or ios\.bluetoothCompanyIdentifiers/],
    ['only names', { ios: { bluetoothNames: ['Acme'] } }, /must list at least one value/],
    [
      'a typo in a key',
      { ios: { bluetoothService: ['180D'] } },
      /ios\.bluetoothService is not a known option/,
    ],
    [
      'a 32-bit service UUID',
      { ios: { bluetoothServices: ['0000180D'] } },
      /ios\.bluetoothServices\[0\] must be a 16-bit/,
    ],
    [
      'a non-array',
      { ios: { bluetoothServices: '180D' } },
      /ios\.bluetoothServices must be an array/,
    ],
    [
      'a hex string company ID',
      { ios: { bluetoothCompanyIdentifiers: ['004C'] } },
      /bluetoothCompanyIdentifiers\[0\] must be an integer/,
    ],
    [
      'an out-of-range company ID',
      { ios: { bluetoothCompanyIdentifiers: [70000] } },
      /between 0 and 65535/,
    ],
    [
      'an empty name',
      { ios: { bluetoothServices: ['180D'], bluetoothNames: [''] } },
      /bluetoothNames\[0\] must be a non-empty string/,
    ],
    [
      'a non-boolean flag',
      { ...minimal, android: { runInBackground: 'yes' } },
      /android\.runInBackground must be a boolean/,
    ],
  ])('rejects %s with a message naming the field', (_, props, message) => {
    expect(() => parseOptions(props)).toThrow(message);
  });
});

describe('setAccessorySetupInfoPlist', () => {
  it('writes the configured AccessorySetupKit keys and leaves out empty ones', () => {
    const plist = setAccessorySetupInfoPlist(
      {},
      parseOptions({ ios: { bluetoothCompanyIdentifiers: [76], bluetoothNames: ['Acme'] } })
    );

    expect(plist).toEqual({
      NSAccessorySetupKitSupports: ['Bluetooth'],
      NSAccessorySetupBluetoothNames: ['Acme'],
      NSAccessorySetupBluetoothCompanyIdentifiers: ['004C'],
    });
  });

  it('removes a key whose values were removed from the config', () => {
    const plist = setAccessorySetupInfoPlist(
      { NSAccessorySetupBluetoothNames: [] },
      parseOptions({ ios: { bluetoothServices: ['180D'] } })
    );

    expect(plist).not.toHaveProperty('NSAccessorySetupBluetoothNames');
  });

  it('keeps existing supported technologies and unrelated keys', () => {
    const plist = setAccessorySetupInfoPlist(
      { NSAccessorySetupKitSupports: ['WiFi'], CFBundleName: 'App' },
      parseOptions(minimal)
    );

    expect(plist.NSAccessorySetupKitSupports).toEqual(['WiFi', 'Bluetooth']);
    expect(plist.CFBundleName).toBe('App');
  });
});

describe('setAccessorySetupManifest', () => {
  function permissions(manifest: AndroidManifest) {
    return (manifest.manifest['uses-permission'] ?? []).map((p) => p.$);
  }

  it('declares the optional companion feature and only connect-time Bluetooth permissions by default', () => {
    const manifest = setAccessorySetupManifest(emptyManifest(), parseOptions(minimal));

    expect(manifest.manifest['uses-feature']).toEqual([
      {
        $: {
          'android:name': 'android.software.companion_device_setup',
          'android:required': 'false',
        },
      },
    ]);
    expect(permissions(manifest)).toEqual([
      { 'android:name': 'android.permission.BLUETOOTH', 'android:maxSdkVersion': '30' },
      { 'android:name': 'android.permission.BLUETOOTH_ADMIN', 'android:maxSdkVersion': '30' },
      { 'android:name': 'android.permission.BLUETOOTH_CONNECT' },
    ]);
  });

  it('adds the background permissions behind their flags', () => {
    const manifest = setAccessorySetupManifest(
      emptyManifest(),
      parseOptions({ ...minimal, android: { runInBackground: true, useDataInBackground: true } })
    );

    expect(permissions(manifest).map((p) => p['android:name'])).toEqual(
      expect.arrayContaining([
        'android.permission.REQUEST_COMPANION_RUN_IN_BACKGROUND',
        'android.permission.REQUEST_COMPANION_USE_DATA_IN_BACKGROUND',
      ])
    );
  });

  it('does not duplicate entries another plugin already added', () => {
    const manifest = emptyManifest();
    manifest.manifest['uses-permission'] = [
      { $: { 'android:name': 'android.permission.BLUETOOTH' } },
    ];
    manifest.manifest['uses-feature'] = [
      {
        $: {
          'android:name': 'android.software.companion_device_setup',
          'android:required': 'true',
        },
      },
    ];

    setAccessorySetupManifest(manifest, parseOptions(minimal));
    setAccessorySetupManifest(manifest, parseOptions(minimal));

    const names = permissions(manifest).map((p) => p['android:name']);
    expect(names).toEqual([...new Set(names)]);
    expect(manifest.manifest['uses-feature']).toHaveLength(1);
  });

  it('limits legacy permissions that another plugin added, keeping an existing limit', () => {
    const manifest = emptyManifest();
    manifest.manifest['uses-permission'] = [
      { $: { 'android:name': 'android.permission.BLUETOOTH' } },
      {
        $: { 'android:name': 'android.permission.BLUETOOTH_ADMIN', 'android:maxSdkVersion': '28' },
      },
    ] as AndroidManifest['manifest']['uses-permission'];

    setAccessorySetupManifest(manifest, parseOptions(minimal));

    expect(permissions(manifest)).toEqual(
      expect.arrayContaining([
        { 'android:name': 'android.permission.BLUETOOTH', 'android:maxSdkVersion': '30' },
        { 'android:name': 'android.permission.BLUETOOTH_ADMIN', 'android:maxSdkVersion': '28' },
      ])
    );
  });
});

describe('withAccessorySetup', () => {
  const config: ExpoConfig = { name: 'app', slug: 'app' };

  it('fails during config evaluation when the options are invalid', () => {
    expect(() => withAccessorySetup(config, { ios: {} })).toThrow(/Invalid plugin options/);
  });

  it('accepts valid options', () => {
    expect(() => withAccessorySetup(config, minimal)).not.toThrow();
  });
});
