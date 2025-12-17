// /app/screens/PreviewScreen.js
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';


const formatTableMessage = (rows, title) => {
  if (!Array.isArray(rows) || !rows.length) return '';

  const parsePriceValue = (price) => {
    const numeric = Number(String(price ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const total = rows.reduce((sum, row) => sum + parsePriceValue(row?.price), 0);
  const heading = title ? `Selected items from ${title}` : 'Selected items';
  const tableLines = [
    heading,
    '| # | Item | Qty | Price |',
    '| --- | --- | --- | --- |',
    ...rows.map((row, index) => {
      const itemName = row?.name || '-';
      const qty = row?.qty || '-';
      const price = row?.price?.trim?.() ? row.price : '-';
      return `| ${index + 1} | ${itemName} | ${qty} | ${price} |`;
    }),
  ];

  if (total > 0) {
    const formattedTotal = total % 1 === 0 ? total.toString() : total.toFixed(2);
    tableLines.push(`|  |  | Total | ₹${formattedTotal} |`);
  }

  return tableLines.join('\n');
};
export default function SelectedPreview() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preview, roomId, roomKey, peerId, title, phone, image, listTitle } = useLocalSearchParams();

  const items = useMemo(() => {
    try {
      return JSON.parse(preview || '[]');
    } catch {
      return [];
    }
  }, [preview]);

  const chatParams = useMemo(() => {
    const entries = {
      roomId,
      roomKey,
      peerId,
      title,
      phone,
      image,
    };
    return Object.fromEntries(
      Object.entries(entries)
        .filter(([, value]) => value != null && `${value}`.length > 0)
        .map(([key, value]) => [key, String(value)]),
    );
  }, [image, peerId, phone, roomId, roomKey, title]);

  const formattedTable = useMemo(() => formatTableMessage(items, listTitle), [items, listTitle]);
  const handleSend = () => {
    if (!items.length || !formattedTable) {
      router.back();
      return;
    }

  // parse the passed data
    const messageId = Date.now().toString();
      router.replace({
        pathname: '/screens/ChatDetailScreen',
        params: {
          ...chatParams,
          tableMessage: formattedTable,
          tableMessageId: messageId,
        },
      });
    };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
            {listTitle ? String(listTitle) : 'Preview'}
          </Text> <Text style={styles.headerTitle}>Preview</Text>
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
         onPress={handleSend}
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
