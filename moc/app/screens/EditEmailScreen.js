import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditEmailScreen() {
  const router = useRouter();
  const { currentEmail } = useLocalSearchParams();
  const [email, setEmail] = useState(typeof currentEmail === 'string' ? currentEmail : '');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmedEmail = email.trim();

    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address or leave the field blank.');
      return;
    }

    router.replace({
      pathname: '/screens/AccountSettings',
      params: { updatedEmail: trimmedEmail },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Email</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError('');
            }}
            placeholder="Add your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Text style={styles.subText}>
            Add an email address so we can reach you with important updates. Leave blank if you
            prefer not to share one.
          </Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputWrapper: { paddingHorizontal: 16, marginTop: 24 },
  label: { fontSize: 14, marginBottom: 8, color: '#444' },
  input: {
    borderWidth: 2,
    borderColor: '#1f6ea7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  subText: { fontSize: 13, color: '#555', marginTop: 16 },
  error: { color: '#c53030', marginTop: 8 },
  saveBtn: {
    backgroundColor: '#1f6ea7',
    padding: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});