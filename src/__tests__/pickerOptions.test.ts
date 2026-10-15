import type { ShowPickerOptions } from '../ExpoAccessorySetup.types';
import { toNativePickerOptions } from '../pickerOptions';

const base: ShowPickerOptions = {
  filter: { serviceUUID: '180D' },
  ios: { displayName: 'Acme Sensor', productImage: { uri: 'file:///sensor.png' } },
};

function withFilter(filter: ShowPickerOptions['filter']): ShowPickerOptions {
  return { ...base, filter };
}

describe('toNativePickerOptions for Android', () => {
  it.each([
    ['180d', '0000180D-0000-1000-8000-00805F9B34FB'],
    ['0000180D', '0000180D-0000-1000-8000-00805F9B34FB'],
    ['6e400001-b5a3-f393-e0a9-e50e24dcca9e', '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'],
  ])('expands service UUID %s to %s', (input, expected) => {
    expect(toNativePickerOptions(withFilter({ serviceUUID: input }), 'android')).toMatchObject({
      serviceUUID: expected,
    });
  });

  it('defaults singleDevice to true and leaves out the iOS display fields', () => {
    const result = toNativePickerOptions(base, 'android');

    expect(result).toEqual({
      serviceUUID: '0000180D-0000-1000-8000-00805F9B34FB',
      companyIdentifier: undefined,
      nameSubstring: undefined,
      singleDevice: true,
      namePattern: undefined,
    });
  });

  it('passes android.namePattern and singleDevice through', () => {
    const result = toNativePickerOptions(
      { ...base, android: { singleDevice: false, namePattern: '^Acme-\\d+$' } },
      'android'
    );

    expect(result).toMatchObject({ singleDevice: false, namePattern: '^Acme-\\d+$' });
  });
});

describe('toNativePickerOptions for iOS', () => {
  it('keeps 16-bit service UUIDs short so they match Info.plist entries', () => {
    expect(toNativePickerOptions(base, 'ios')).toMatchObject({ serviceUUID: '180D' });
  });

  it('accepts a company identifier without a service UUID', () => {
    expect(toNativePickerOptions(withFilter({ companyIdentifier: 0x004c }), 'ios')).toMatchObject({
      serviceUUID: undefined,
      companyIdentifier: 0x004c,
    });
  });

  it('honors range', () => {
    expect(
      toNativePickerOptions({ ...base, ios: { ...base.ios, range: 'immediate' } }, 'ios')
    ).toMatchObject({ range: 'immediate' });
  });
});

describe('invalid options', () => {
  it.each<[string, ShowPickerOptions, RegExp]>([
    ['no identifier', withFilter({ nameSubstring: 'Acme' }), /serviceUUID or a companyIdentifier/],
    ['malformed UUID', withFilter({ serviceUUID: '180' }), /not a 16-bit, 32-bit, or 128-bit UUID/],
    ['company ID too large', withFilter({ companyIdentifier: 0x10000 }), /between 0 and 0xFFFF/],
    ['fractional company ID', withFilter({ companyIdentifier: 1.5 }), /between 0 and 0xFFFF/],
    [
      'empty name substring',
      withFilter({ serviceUUID: '180D', nameSubstring: ' ' }),
      /nameSubstring/,
    ],
    ['empty display name', { ...base, ios: { ...base.ios, displayName: '' } }, /ios.displayName/],
  ])('rejects %s', (_, options, message) => {
    expect(() => toNativePickerOptions(options, 'ios')).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTIONS', message: expect.stringMatching(message) })
    );
  });
});
