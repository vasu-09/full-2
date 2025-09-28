import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiClient, { apiBaseURL } from '../services/apiClient';

const LoginScreen = () => {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendOtp = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter your phone number before continuing.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await apiClient.post('/auth/otp/send', { phone: trimmedPhone });

     router.push({
        pathname: '/screens/OtpScreen',
        params: { phone: trimmedPhone },
      });
    } catch (err) {
      console.error('Failed to send OTP:', err.message);
      setError('Unable to send OTP. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#535846" barStyle="light-content" />
      <Text style={styles.logo}>MoC</Text>
        <Text style={styles.baseUrl}>API: {apiBaseURL}</Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

       <Text style={styles.label}>Enter your mobile number</Text>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g. 9876543210"
        placeholderTextColor="#888"
      />
      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={sendOtp}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Sending…' : 'Send OTP'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1f6ea7',
    alignSelf: 'center',
    marginBottom: 40,
  },
  baseUrl: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 18,
    marginBottom: 12,
    textAlign: 'left',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f6ea7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#1f6ea7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c53030',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default LoginScreen;
