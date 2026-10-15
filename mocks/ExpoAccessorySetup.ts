export function isSupported(): boolean {
  return true;
}

export async function showPicker(): Promise<never> {
  throw Object.assign(new Error('User cancelled'), { code: 'USER_CANCELLED' });
}

export async function getPairedAccessories(): Promise<never[]> {
  return [];
}

export async function removeAccessory(): Promise<void> {}
