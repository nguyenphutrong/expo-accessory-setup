import NativeModule from '../ExpoAccessorySetupModule';
import {
  AccessorySetupError,
  addAccessoryListener,
  getPairedAccessories,
  isAccessorySetupError,
  isSupported,
  removeAccessory,
  showPicker,
  type PairedAccessory,
  type ShowPickerOptions,
} from '../index';

const native = jest.mocked(NativeModule!);

const accessory: PairedAccessory = {
  id: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  bleIdentifier: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  displayName: 'Acme Sensor',
  platform: 'ios',
};

const options: ShowPickerOptions = {
  filter: { serviceUUID: '180d', nameSubstring: 'Acme' },
  ios: { displayName: 'Acme Sensor', productImage: { uri: 'file:///sensor.png' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  native.isSupported.mockReturnValue(true);
});

describe('showPicker', () => {
  it('sends the normalized iOS options and resolves with the picked accessory', async () => {
    native.showPicker.mockResolvedValueOnce(accessory);

    await expect(showPicker(options)).resolves.toEqual(accessory);
    expect(native.showPicker).toHaveBeenCalledWith({
      serviceUUID: '180D',
      companyIdentifier: undefined,
      nameSubstring: 'Acme',
      displayName: 'Acme Sensor',
      productImageUri: 'file:///sensor.png',
      range: 'default',
    });
  });

  it.each(['USER_CANCELLED', 'ALREADY_IN_PROGRESS', 'DISCOVERY_TIMEOUT'] as const)(
    'maps a native %s rejection to a typed error that keeps the native message',
    async (code) => {
      native.showPicker.mockRejectedValueOnce(Object.assign(new Error('native says no'), { code }));

      const error = await showPicker(options).catch((e: unknown) => e);
      expect(isAccessorySetupError(error, code)).toBe(true);
      expect((error as AccessorySetupError).message).toBe('native says no');
    }
  );

  it('maps an unrecognized native code to UNKNOWN', async () => {
    native.showPicker.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'ERR_SOMETHING_ELSE' })
    );

    await expect(showPicker(options)).rejects.toMatchObject({ code: 'UNKNOWN', message: 'boom' });
  });

  it('rejects with INVALID_OPTIONS without calling native when the filter has no identifier', async () => {
    const error = await showPicker({ ...options, filter: { nameSubstring: 'Acme' } }).catch(
      (e: unknown) => e
    );

    expect(isAccessorySetupError(error, 'INVALID_OPTIONS')).toBe(true);
    expect(native.showPicker).not.toHaveBeenCalled();
  });

  it('rejects with UNSUPPORTED without calling native when the device is unsupported', async () => {
    native.isSupported.mockReturnValue(false);

    await expect(showPicker(options)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(native.showPicker).not.toHaveBeenCalled();
  });
});

describe('getPairedAccessories and removeAccessory', () => {
  it('returns the native list', async () => {
    native.getPairedAccessories.mockResolvedValueOnce([accessory]);

    await expect(getPairedAccessories()).resolves.toEqual([accessory]);
  });

  it('maps a native NOT_FOUND rejection on remove', async () => {
    native.removeAccessory.mockRejectedValueOnce(
      Object.assign(new Error('no such accessory'), { code: 'NOT_FOUND' })
    );

    await expect(removeAccessory('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(native.removeAccessory).toHaveBeenCalledWith('missing');
  });
});

describe('addAccessoryListener', () => {
  it('delivers native events until the subscription is removed', () => {
    const listener = jest.fn();
    const subscription = addAccessoryListener('accessoryRemoved', listener);

    native.emit('onAccessoryRemoved', { accessory });
    native.emit('onAccessoryAdded', { accessory });
    subscription.remove();
    native.emit('onAccessoryRemoved', { accessory });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ accessory });
  });
});

describe('without the native module (Expo Go, web)', () => {
  let api: typeof import('../index');

  beforeEach(() => {
    jest.isolateModules(() => {
      jest.doMock('../ExpoAccessorySetupModule', () => ({ __esModule: true, default: null }));
      api = require('../index');
    });
  });

  it('reports unsupported and rejects every call with UNSUPPORTED', async () => {
    expect(api.isSupported()).toBe(false);
    await expect(api.showPicker(options)).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(api.getPairedAccessories()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(api.removeAccessory('x')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('returns a no-op subscription', () => {
    expect(() => api.addAccessoryListener('accessoryAdded', jest.fn()).remove()).not.toThrow();
  });
});

it('isSupported reflects the native answer', () => {
  native.isSupported.mockReturnValue(false);
  expect(isSupported()).toBe(false);
});
