import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function AccountSettings() {
  const router = useRouter();
  const { updatedUri, updatedName, updatedEmail } = useLocalSearchParams();

  const defaultPhoto = 'https://randomuser.me/api/portraits/men/2.jpg';
  const [photoUri, setPhotoUri] = useState(defaultPhoto);
  const [name, setName] = useState('Srinivas Gurazala');
   const [email, setEmail] = useState('');

  const getParamValue = (param) => (Array.isArray(param) ? param[0] : param);

  useEffect(() => {
    const nextUri = getParamValue(updatedUri);
    if (typeof nextUri === 'string' && nextUri.length) setPhotoUri(nextUri);
  }, [updatedUri]);

   useEffect(() => {
    const nextName = getParamValue(updatedName);
    if (typeof nextName === 'string') setName(nextName);
  }, [updatedName]);

  useEffect(() => {
    const nextEmail = getParamValue(updatedEmail);
    if (typeof nextEmail === 'string') setEmail(nextEmail);
  }, [updatedEmail]);

  const openPhotoPicker = () => {
    router.push({ pathname: '/screens/ProfilePhotoScreen', params: { uri: photoUri } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>

      <View style={styles.profileSection}>
           <TouchableOpacity onPress={openPhotoPicker}>
          <Image source={{ uri: photoUri }} style={styles.avatar} />
        </TouchableOpacity>

           <TouchableOpacity onPress={openPhotoPicker}>
          <Text style={styles.changePhoto}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() =>
          router.push({ pathname: '/screens/EditNameScreen', params: { currentName: name } })
        }
      >
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Display Name</Text>
          <View style={styles.editRow}>
            <Text style={styles.input}>{name}</Text>
            <Icon name="edit" size={20} color="#1f6ea7" />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          router.push({ pathname: '/screens/EditEmailScreen', params: { currentEmail: email } })
        }
      >
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.editRow}>
            <Text style={[styles.input, !email && styles.placeholderText]}>
              {email || 'Add an email address'}
            </Text>
            <Icon name="edit" size={20} color="#1f6ea7" />
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Phone Number</Text>
        <Text style={styles.staticText}>+91 9876543210</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, color: '#fff', fontWeight: '600' },
  profileSection: { alignItems: 'center', marginVertical: 24 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ccc',
  },
  changePhoto: { color: '#1f6ea7', marginTop: 8, fontSize: 14 },
  fieldContainer: { paddingHorizontal: 16, marginVertical: 10 },
  label: { color: '#666', marginBottom: 4, fontSize: 14 },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 6,
    color: '#333',
  },
   placeholderText: { color: '#999' },
  staticText: { fontSize: 16, color: '#333', paddingVertical: 6 },
});
