import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rawPhone = Array.isArray(params.phoneNumber) ? params.phoneNumber[0] : params.phoneNumber;
  const rawInitialName = Array.isArray(params.initialName) ? params.initialName[0] : params.initialName;
  const displayPhone = typeof rawPhone === 'string' && rawPhone.trim() ? rawPhone : '';
  const [photoUri, setPhotoUri] = useState(null);
  const [name, setName] = useState(
    typeof rawInitialName === 'string' && rawInitialName.trim() ? rawInitialName : ''
  );
  const [error, setError] = useState('');

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Please add your name before continuing.');
      return;
    }

    router.replace('/screens/MocScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.heading}>Profile Info</Text>
          <Text style={styles.subHeading}>
            Add your name and profile photo so friends can recognise you.
          </Text>
          {displayPhone ? (
            <Text style={styles.phoneLabel}>Signed in with {displayPhone}</Text>
          ) : null}

          <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrapper}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Icon name="person" size={52} color="#fff" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Icon name="photo-camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickPhoto}>
            <Text style={styles.changePhoto}>Add profile photo</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (error) setError('');
              }}
              placeholder="Enter your name"
              style={styles.input}
              maxLength={25}
            />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  content: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 40 },
  heading: { fontSize: 24, fontWeight: '600', color: '#1f6ea7' },
  subHeading: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 16,
  },
  phoneLabel: { marginTop: 12, color: '#1f6ea7', fontSize: 14 },
  avatarWrapper: {
    marginTop: 40,
    marginBottom: 12,
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  placeholderAvatar: {
    backgroundColor: '#1f6ea7',
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 6,
    right: 14,
    backgroundColor: '#1f6ea7',
    borderRadius: 16,
    padding: 6,
  },
  changePhoto: { color: '#1f6ea7', fontSize: 14 },
  inputWrapper: {
    width: '100%',
    marginTop: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#1f6ea7',
  },
  input: { fontSize: 18, paddingVertical: 8, textAlign: 'center', color: '#000' },
  error: { color: '#c53030', marginTop: 12 },
  continueBtn: {
    backgroundColor: '#1f6ea7',
    paddingVertical: 16,
    margin: 24,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});