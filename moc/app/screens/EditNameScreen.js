import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function EditNameScreen() {
  const router = useRouter();
  const { currentName } = useLocalSearchParams();
  const [name, setName] = useState(currentName || '');

  const handleSave = () => {
    router.replace({
      pathname: '/screens/settings/AccountSettings',
      params: { updatedName: name },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Name</Text>
      </View>

      <View style={styles.inputWrapper}>
        <Text style={styles.label}>Your name</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={25}
            style={styles.input}
          />
          <Icon name="emoji-emotions" size={22} color="#888" />
        </View>
        <Text style={styles.charCount}>{name.length}/25</Text>
        <Text style={styles.subText}>
          People will see this name if you interact with them and they don’t have you saved as a contact.
        </Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  inputWrapper: { marginTop: 32 },
  label: { fontSize: 14, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1f6ea7',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  charCount: { textAlign: 'right', color: '#888', marginTop: 4 },
  subText: { fontSize: 13, color: '#555', marginTop: 16 },
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
