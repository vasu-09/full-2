import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FCM_TOKEN_KEY = 'fcmToken';

const getDeviceModel = () => {
  if (Constants?.deviceName) return Constants.deviceName;
  if (Platform?.constants?.Model) return Platform.constants.Model;
  return 'unknown';
};

const getAppVersion = () => {
  if (Constants?.expoConfig?.version) return Constants.expoConfig.version;
  if (Constants?.nativeAppVersion) return Constants.nativeAppVersion;
  if (Constants?.manifest2?.extra?.expoClient?.version) {
    return Constants.manifest2.extra.expoClient.version;
  }
  return 'unknown';
};

export const getDeviceMetadata = async () => {
  let storedFcmToken = '';
  try {
    const value = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (typeof value === 'string') {
      storedFcmToken = value;
    }
  } catch (err) {
    console.warn('Unable to read stored FCM token', err);
  }

  return {
    deviceModel: getDeviceModel(),
    platform: Platform.OS,
    appVersion: getAppVersion(),
    fcmToken: storedFcmToken,
  };
};

export const setStoredFcmToken = async (token) => {
  try {
    if (!token) {
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);
      return;
    }
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
  } catch (err) {
    console.warn('Unable to store FCM token', err);
  }
};