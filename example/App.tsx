import { isSupported } from 'expo-accessory-setup';
import { SafeAreaView, Text } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Accessory setup supported: {String(isSupported())}</Text>
    </SafeAreaView>
  );
}
