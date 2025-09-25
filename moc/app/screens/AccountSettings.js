import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function AccountSettings() {
  const router = useRouter();
  const { updatedUri } = useLocalSearchParams();

  const defaultPhoto = 'https://randomuser.me/api/portraits/men/2.jpg';
  const [photoUri, setPhotoUri] = useState(defaultPhoto);
  const [name, setName] = useState('Srinivas Gurazala');

  useEffect(() => {
    if (updatedUri) setPhotoUri(updatedUri);
  }, [updatedUri]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => router.replace('/auth/LoginScreen') },
    ]);
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
        <TouchableOpacity onPress={() =>
          router.push({ pathname: '/screens/ProfilePhotoScreen', params: { uri: photoUri } })
        }>
          <Image source={{ uri: photoUri }} style={styles.avatar} />
        </TouchableOpacity>

        <TouchableOpacity>
          <Text style={styles.changePhoto}>Change Photo</Text>
        </TouchableOpacity>
      </View>

     <TouchableOpacity onPress={() => router.push({ pathname: '/screens/EditNameScreen', params: { currentName: name } })}>
  <View style={styles.fieldContainer}>
    <Text style={styles.label}>Display Name</Text>
    <View style={styles.editRow}>
      <Text style={styles.input}>{name}</Text>
      <Icon name="edit" size={20} color="#1f6ea7" />
    </View>
  </View>
</TouchableOpacity>

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Phone Number</Text>
        <Text style={styles.staticText}>+91 9876543210</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Icon name="logout" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
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
  staticText: { fontSize: 16, color: '#333', paddingVertical: 6 },
  logoutBtn: {
    marginTop: 30,
    marginHorizontal: 16,
    backgroundColor: '#e53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, marginLeft: 8 },
});
