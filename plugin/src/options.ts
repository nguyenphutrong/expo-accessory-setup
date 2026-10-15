export type AccessorySetupPluginProps = {
  ios?: {
    /** 16-bit (`"180D"`) or 128-bit service UUIDs that `showPicker` filters may use. */
    bluetoothServices?: string[];
    /** Advertised names or name substrings that `showPicker` filters may use. */
    bluetoothNames?: string[];
    /** Bluetooth SIG company identifiers (0 to 0xFFFF) that `showPicker` filters may use. */
    bluetoothCompanyIdentifiers?: number[];
  };
  android?: {
    /** Adds `REQUEST_COMPANION_RUN_IN_BACKGROUND`. */
    runInBackground?: boolean;
    /** Adds `REQUEST_COMPANION_USE_DATA_IN_BACKGROUND`. */
    useDataInBackground?: boolean;
  };
};

export type AccessorySetupOptions = {
  ios: {
    bluetoothServices: string[];
    bluetoothNames: string[];
    /** Four upper-case hex digits, e.g. `"004C"`. */
    bluetoothCompanyIdentifiers: string[];
  };
  android: {
    runInBackground: boolean;
    useDataInBackground: boolean;
  };
};

const UUID_16 = /^[0-9A-F]{4}$/;
const UUID_128 = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

function fail(message: string): never {
  throw new Error(`[expo-accessory-setup] Invalid plugin options: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSection(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    fail(`${path} must be an object.`);
  }
  const unknownKey = Object.keys(value).find((key) => !keys.includes(key));
  if (unknownKey !== undefined) {
    fail(`${path}.${unknownKey} is not a known option. Known options: ${keys.join(', ')}.`);
  }
  return value;
}

function parseArray<T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, path: string) => T
) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail(`${path} must be an array.`);
  }
  return [...new Set(value.map((item, index) => parseItem(item, `${path}[${index}]`)))];
}

function parseServiceUUID(value: unknown, path: string): string {
  const uuid = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!UUID_16.test(uuid) && !UUID_128.test(uuid)) {
    fail(`${path} must be a 16-bit ("180D") or 128-bit UUID string, got ${JSON.stringify(value)}.`);
  }
  return uuid;
}

function parseName(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${path} must be a non-empty string, got ${JSON.stringify(value)}.`);
  }
  return value;
}

function parseCompanyIdentifier(value: unknown, path: string): string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffff) {
    fail(`${path} must be an integer between 0 and 65535 (0xFFFF), got ${JSON.stringify(value)}.`);
  }
  return value.toString(16).toUpperCase().padStart(4, '0');
}

function parseBoolean(value: unknown, path: string): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value !== 'boolean') {
    fail(`${path} must be a boolean, got ${JSON.stringify(value)}.`);
  }
  return value;
}

export function parseOptions(props: unknown): AccessorySetupOptions {
  const root = parseSection(props ?? {}, 'options', ['ios', 'android']);
  const ios = parseSection(root.ios, 'ios', [
    'bluetoothServices',
    'bluetoothNames',
    'bluetoothCompanyIdentifiers',
  ]);
  const android = parseSection(root.android, 'android', ['runInBackground', 'useDataInBackground']);

  const options: AccessorySetupOptions = {
    ios: {
      bluetoothServices: parseArray(
        ios.bluetoothServices,
        'ios.bluetoothServices',
        parseServiceUUID
      ),
      bluetoothNames: parseArray(ios.bluetoothNames, 'ios.bluetoothNames', parseName),
      bluetoothCompanyIdentifiers: parseArray(
        ios.bluetoothCompanyIdentifiers,
        'ios.bluetoothCompanyIdentifiers',
        parseCompanyIdentifier
      ),
    },
    android: {
      runInBackground: parseBoolean(android.runInBackground, 'android.runInBackground'),
      useDataInBackground: parseBoolean(android.useDataInBackground, 'android.useDataInBackground'),
    },
  };

  if (
    options.ios.bluetoothServices.length === 0 &&
    options.ios.bluetoothCompanyIdentifiers.length === 0
  ) {
    fail(
      'ios.bluetoothServices or ios.bluetoothCompanyIdentifiers must list at least one value. ' +
        'AccessorySetupKit only discovers accessories by service UUID or company identifier, ' +
        'and the app crashes if a picker filter uses a value missing from Info.plist.'
    );
  }
  return options;
}
