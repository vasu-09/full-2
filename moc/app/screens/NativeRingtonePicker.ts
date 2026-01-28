// NativeRingtonePicker.ts
import { NativeModules, Platform } from 'react-native';

const { RingtonePicker } = NativeModules;

const openNativeTonePicker = async (type: 'notification' | 'ringtone') => {
  if (!RingtonePicker?.openRingtonePicker) {
    const platformHint = Platform.OS === 'android'
      ? 'Ensure the native module is linked in your Android build.'
      : 'This picker is only available on Android.';
    console.warn(
      `RingtonePicker native module is unavailable. ${platformHint} ` +
        'If you are using Expo Go, use a custom dev client or a native build.'
    );
    return null;
  }

try {
    const result: { uri: string; title: string } =
      await RingtonePicker.openRingtonePicker(type);
    return result;
  } catch (error: unknown) {
    console.error('Ringtone Picker Error:', error);
    return null;
  }
};

export default openNativeTonePicker;