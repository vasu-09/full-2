// NativeRingtonePicker.ts
import { NativeModules } from 'react-native';

const { RingtonePicker } = NativeModules;

const openNativeTonePicker = (type: 'notification' | 'ringtone') =>
  RingtonePicker.openRingtonePicker(type)
    .then((result: { uri: string; title: string }) => result)
    .catch((error: unknown) => {
      console.error('Ringtone Picker Error:', error);
      return null;
    });

export default openNativeTonePicker;