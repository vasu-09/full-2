// /app/screens/PreviewScreen.js
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useChatSession } from '../hooks/useChatSession';

export default function SelectedPreview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const preview = params?.preview;
  const roomId = params?.roomId ? Number(params.roomId) : null;
  const roomKey = params?.roomKey ? String(params.roomKey) : null;
  const peerId = params?.peerId ? Number(params.peerId) : null;
  const title = params?.title ? String(params.title) : null;
  const listTitle = params?.listTitle ? String(params.listTitle) : 'Shared List';
  const [isSending, setIsSending] = useState(false);
  const { sendTextMessage } = useChatSession({
    roomId,
    roomKey,
    peerId,
    title,
  });

  // parse the passed data
  let items = [];
  try { items = JSON.parse(preview || '[]'); }
  catch {}

  const rows = items.map(item => ({
    name: item.name,
    qty: item.qty,
    price: item.price,
  }));
  const totalValue = rows.reduce((sum, row) => {
    const rowValue = parseInt(String(row.price ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    return sum + rowValue;
  }, 0);
  const total = `₹${totalValue}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <View style={{ width: 40 }}/>
      </View>

      {/* list */}
      <FlatList
        data={items}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={[styles.cell, { flex: 0.5 }]}>{index + 1}.</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
            <Text style={[styles.cell, { flex: 2 }]}>{item.qty}</Text>
            <Text style={[styles.cell, { flex: 1, textAlign: 'right' }]}>{item.price}</Text>
          </View>
        )}
      />

      {/* send arrow */}
      <TouchableOpacity
        style={[styles.sendBtn, { bottom: insets.bottom + 24 }]}
        onPress={async () => {
          if (isSending) return;
          setIsSending(true);
          const payload = {
            type: 'todo_table',
            title: listTitle,
            rows,
            total,
          };
          const serializedPayload = JSON.stringify(payload);
          const sent = await sendTextMessage(serializedPayload);
          setIsSending(false);
          if (sent) {
            router.back();
          } else {
            Alert.alert('Send failed', 'Unable to send the list. Please try again.');
          }
        }}
      >
        <Icon name="send" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef5fa' },
  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center'
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cell: {
    fontSize: 16,
    color: '#333',
    marginHorizontal: 4,
  },

  sendBtn: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f6ea7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
