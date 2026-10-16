import {
  addAccessoryListener,
  getPairedAccessories,
  isAccessorySetupError,
  isSupported,
  removeAccessory,
  showPicker,
  type PairedAccessory,
} from 'expo-accessory-setup';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// Heart Rate service. Any heart rate strap or watch broadcasting it shows up in the picker.
// The same UUID is declared for the config plugin in app.json.
const HEART_RATE_SERVICE = '180D';

function describeError(error: unknown): string {
  if (isAccessorySetupError(error)) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function ensureConnectPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return true;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export default function App() {
  const bleManager = useRef<BleManager | null>(null);
  const [accessories, setAccessories] = useState<PairedAccessory[]>([]);
  const [status, setStatus] = useState('Idle');

  const refresh = useCallback(async () => {
    try {
      setAccessories(await getPairedAccessories());
    } catch (error) {
      setStatus(describeError(error));
    }
  }, []);

  useEffect(() => {
    if (!isSupported()) {
      return;
    }
    refresh();
    const subscriptions = [
      addAccessoryListener('accessoryAdded', refresh),
      addAccessoryListener('accessoryRemoved', refresh),
      addAccessoryListener('accessoryChanged', refresh),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [refresh]);

  useEffect(
    () => () => {
      bleManager.current?.destroy();
    },
    []
  );

  async function pair() {
    setStatus('Showing picker…');
    try {
      const accessory = await showPicker({
        filter: { serviceUUID: HEART_RATE_SERVICE },
        ios: {
          displayName: 'Heart rate sensor',
          productImage: require('./assets/icon.png'),
        },
        android: { singleDevice: false },
      });
      setStatus(`Paired ${accessory.displayName} (${accessory.bleIdentifier})`);
    } catch (error) {
      setStatus(describeError(error));
    }
  }

  async function connect(accessory: PairedAccessory) {
    if (!(await ensureConnectPermission())) {
      setStatus('Bluetooth connect permission denied');
      return;
    }
    // Created on first use. With AccessorySetupKit, CoreBluetooth only powers on once the app
    // has a paired accessory, and it only sees accessories paired through the picker.
    bleManager.current ??= new BleManager();
    setStatus(`Connecting to ${accessory.displayName}…`);
    try {
      const device = await bleManager.current.connectToDevice(accessory.bleIdentifier);
      await device.discoverAllServicesAndCharacteristics();
      const services = await device.services();
      setStatus(
        `Connected to ${accessory.displayName}. Services: ${services.map((s) => s.uuid).join(', ')}`
      );
      await device.cancelConnection();
    } catch (error) {
      setStatus(describeError(error));
    }
  }

  async function remove(accessory: PairedAccessory) {
    try {
      await removeAccessory(accessory.id);
      setStatus(`Removed ${accessory.displayName}`);
    } catch (error) {
      setStatus(describeError(error));
    }
  }

  if (!isSupported()) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>expo-accessory-setup</Text>
        <Text style={styles.body}>
          Accessory setup is not supported here. It needs a development build on iOS 18+ or an
          Android device with companion device setup.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>expo-accessory-setup</Text>
        <Button title="Pair accessory" onPress={pair} />
        <Text style={styles.status} testID="status">
          {status}
        </Text>
        <Text style={styles.section}>Paired accessories</Text>
        {accessories.length === 0 && <Text style={styles.body}>None yet.</Text>}
        {accessories.map((accessory) => (
          <View key={accessory.id} style={styles.card}>
            <Text style={styles.name}>{accessory.displayName}</Text>
            <Text style={styles.body}>{accessory.bleIdentifier}</Text>
            <View style={styles.actions}>
              <Button title="Connect" onPress={() => connect(accessory)} />
              <Button title="Remove" color="#c0392b" onPress={() => remove(accessory)} />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  content: { padding: 20, gap: 12 },
  header: { fontSize: 26, fontWeight: '600', marginVertical: 12 },
  section: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  status: { color: '#333' },
  body: { color: '#555' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
