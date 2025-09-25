import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import axios from 'axios';

const LoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const sendOtp = async () => {
    try {
      await axios.post('http://<your-backend-url>/auth/send-otp', { phone });
      setOtpSent(true);
    } catch (error) {
      console.error('Failed to send OTP:', error.message);
    }
  };

  const verifyOtp = async () => {
    try {
      const res = await axios.post('http://<your-backend-url>/auth/verify-otp', { phone, otp });
      const token = res.data.token;
      console.log('Logged in. Token:', token);
    } catch (error) {
      console.error('OTP verification failed:', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#535846" barStyle="light-content" />
      <Text style={styles.logo}>MoC</Text>

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
          <TouchableOpacity style={styles.button} onPress={sendOtp}>
            <Text style={styles.buttonText}>Send OTP</Text>
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
          <TouchableOpacity style={styles.button} onPress={verifyOtp}>
            <Text style={styles.buttonText}>Verify OTP</Text>
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LoginScreen;
