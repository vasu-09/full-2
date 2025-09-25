import axios from 'axios';
import React, { useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const OtpScreen = () => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    if (!/^\d?$/.test(text)) return; // Allow only single digit
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) inputs.current[index + 1].focus();
    if (!text && index > 0) inputs.current[index - 1].focus();
  };

  const verifyOtp = async () => {
    const otpValue = otp.join('');
    try {
      const res = await axios.post('http://<your-backend-url>/auth/verify-otp', {
        phone: '9876543210', // Replace with dynamic
        otp: otpValue,
      });
      console.log('Logged in. Token:', res.data.token);
    } catch (err) {
      console.error('OTP verification failed:', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#64792A" barStyle="light-content" />
      <Text style={styles.logo}>MoC</Text>
      <Text style={styles.label}>Enter the 6-digit code</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputs.current[index] = ref)}
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={verifyOtp}>
        <Text style={styles.buttonText}>Verify</Text>
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
    color: '#64792A',
    alignSelf: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    fontSize: 22,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderColor: '#64792A',
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

export default OtpScreen;
