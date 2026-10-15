import { Image } from 'react-native';

import type { AccessoryPlatform, ImageSource, ShowPickerOptions } from './ExpoAccessorySetup.types';
import { AccessorySetupError } from './errors';

type NativeFilter = {
  /** Upper case. 128-bit form on Android, as given on iOS. */
  serviceUUID?: string;
  companyIdentifier?: number;
  nameSubstring?: string;
};

export type IosNativePickerOptions = NativeFilter & {
  displayName: string;
  productImageUri: string;
  range: 'default' | 'immediate';
};

export type AndroidNativePickerOptions = NativeFilter & {
  singleDevice: boolean;
  namePattern?: string;
};

export type NativePickerOptions = IosNativePickerOptions | AndroidNativePickerOptions;

const UUID_16 = /^[0-9A-F]{4}$/;
const UUID_32 = /^[0-9A-F]{8}$/;
const UUID_128 = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
const BLUETOOTH_BASE_UUID_SUFFIX = '-0000-1000-8000-00805F9B34FB';

function invalid(message: string): never {
  throw new AccessorySetupError('INVALID_OPTIONS', message);
}

function parseServiceUUID(value: string, platform: AccessoryPlatform): string {
  const uuid = value.trim().toUpperCase();
  if (!UUID_16.test(uuid) && !UUID_32.test(uuid) && !UUID_128.test(uuid)) {
    invalid(`filter.serviceUUID "${value}" is not a 16-bit, 32-bit, or 128-bit UUID.`);
  }
  if (platform === 'ios' || UUID_128.test(uuid)) {
    return uuid;
  }
  return `${uuid.padStart(8, '0')}${BLUETOOTH_BASE_UUID_SUFFIX}`;
}

function parseCompanyIdentifier(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    invalid(`filter.companyIdentifier ${value} is not an integer between 0 and 0xFFFF.`);
  }
  return value;
}

function nonEmpty(value: string, field: string): string {
  if (value.trim().length === 0) {
    invalid(`${field} must not be empty.`);
  }
  return value;
}

function resolveImageUri(source: ImageSource): string {
  const uri = typeof source === 'number' ? Image.resolveAssetSource(source)?.uri : source.uri;
  if (!uri) {
    invalid('ios.productImage could not be resolved to a URI.');
  }
  return uri;
}

export function toNativePickerOptions(
  options: ShowPickerOptions,
  platform: AccessoryPlatform
): NativePickerOptions {
  const { serviceUUID, companyIdentifier, nameSubstring } = options.filter;
  if (serviceUUID === undefined && companyIdentifier === undefined) {
    invalid('filter needs a serviceUUID or a companyIdentifier.');
  }
  const filter: NativeFilter = {
    serviceUUID: serviceUUID === undefined ? undefined : parseServiceUUID(serviceUUID, platform),
    companyIdentifier:
      companyIdentifier === undefined ? undefined : parseCompanyIdentifier(companyIdentifier),
    nameSubstring:
      nameSubstring === undefined ? undefined : nonEmpty(nameSubstring, 'filter.nameSubstring'),
  };

  if (platform === 'ios') {
    return {
      ...filter,
      displayName: nonEmpty(options.ios.displayName, 'ios.displayName'),
      productImageUri: resolveImageUri(options.ios.productImage),
      range: options.ios.range ?? 'default',
    };
  }

  const { singleDevice = true, namePattern } = options.android ?? {};
  return {
    ...filter,
    singleDevice,
    namePattern:
      namePattern === undefined ? undefined : nonEmpty(namePattern, 'android.namePattern'),
  };
}
