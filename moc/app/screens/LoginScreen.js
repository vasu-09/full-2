import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import apiClient, { apiBaseURL } from '../services/apiClient';

const LoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendOtp = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      await apiClient.post('/auth/send-otp', { phone });

      setOtpSent(true);
    setMessage('OTP sent successfully.');
    } catch (err) {
      console.error('Failed to send OTP:', err.message);
      setError('Unable to send OTP. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setIsSubmitting(true);
      setError('');
      setMessage('');

      const res = await apiClient.post('/auth/verify-otp', { phone, otp });
      const token = res.data.token;
      console.log('Logged in. Token:', token);
     setMessage('OTP verified. Logged in successfully.');
    } catch (err) {
      console.error('OTP verification failed:', err.message);
      setError('Invalid OTP or server error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#535846" barStyle="light-content" />
      <Text style={styles.logo}>MoC</Text>
       <Text style={styles.baseUrl}>API: {apiBaseURL}</Text>

      {!!message && <Text style={styles.success}>{message}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {!otpSent ? (
        <>
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
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter OTP</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={otp}
            onChangeText={setOtp}
            placeholder="e.g. 123456"
            placeholderTextColor="#888"
          />
          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={verifyOtp}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Verifying…' : 'Verify OTP'}</Text>
          </TouchableOpacity>
        </>
      )}
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
    color: '#64792A',
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
    borderColor: '#64792A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#64792A',
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
  success: {
    color: '#2f855a',
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    color: '#c53030',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default LoginScreen;
