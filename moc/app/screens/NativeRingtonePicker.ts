// NativeRingtonePicker.ts
import { NativeModules } from 'react-native';

const { RingtonePicker } = NativeModules;

const openNativeTonePicker = async (type: 'notification' | 'ringtone') => {
  try {
    const result = await RingtonePicker.openRingtonePicker(type);
    return result; // { uri, title }
  } catch (error) {
    console.error('Ringtone Picker Error:', error);
    return null;
  }
};

export default openNativeTonePicker;