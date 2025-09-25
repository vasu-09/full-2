// LinkListScreen.js
import { useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Dummy contacts
const allContacts = [
  { id: '1',  name: 'Anusha',    img: 'https://randomuser.me/api/portraits/women/15.jpg' },
  { id: '2',  name: 'Bhanu Sha', img: 'https://randomuser.me/api/portraits/men/4.jpg' },
  { id: '3',  name: 'Charan',    img: 'https://randomuser.me/api/portraits/men/6.jpg' },
  { id: '4',  name: 'Damini',    img: 'https://randomuser.me/api/portraits/women/48.jpg' },
  { id: '5',  name: 'Elephant',  img: 'https://randomuser.me/api/portraits/women/54.jpg' },
  { id: '6',  name: 'Frog',      img: 'https://randomuser.me/api/portraits/women/87.jpg' },
  { id: '7',  name: 'Kamkashi',  img: 'https://randomuser.me/api/portraits/women/31.jpg' },
  { id: '8',  name: 'Vasu',      img: 'https://randomuser.me/api/portraits/men/10.jpg' },
  { id: '9',  name: 'Kiran',     img: 'https://randomuser.me/api/portraits/men/14.jpg' },
  { id: '10', name: 'Chinnu',    img: 'https://randomuser.me/api/portraits/women/24.jpg' },
];

const initialSelected = [];

export default function LinkListScreen() {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState(initialSelected);
  const router = useRouter();

  const { listName = '', items = '[]' } = useLocalSearchParams();
  const parsedItems = JSON.parse(items);

  const toggleSelect = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedContacts = allContacts.filter(c => selectedIds.includes(c.id));

  const renderSelectedAvatar = ({ item }) => (
    <View style={styles.avatarContainer}>
      <Image source={{ uri: item.img }} style={styles.avatar} />
      <Text style={styles.avatarName} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity
        style={styles.removeIcon}
        onPress={() => toggleSelect(item.id)}
      >
        <Icon name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderContact = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.contactRow, isSelected && styles.selectedRow]}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: item.img }} style={styles.avatarSmall} />
          {isSelected && (
            <View style={styles.checkOverlay}>
              <Icon name="check" size={14} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.contactName}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}> 
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() =>router.push({
  pathname: '/screens/ViewListScreen',
  params: {
    listName: listName,
    items: JSON.stringify(parsedItems), // serialize full items array
  },
})} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Link the list</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>{selectedIds.length} of {allContacts.length} contacts</Text>
      <View style={styles.listInfo}>
        <Icon name="shopping-cart" size={32} color="#555" />
        <Text style={styles.listName}>{listName}</Text>
      </View>

      <Text style={styles.sectionTitle}>Selected contacts</Text>
      <FlatList
        data={selectedContacts}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={renderSelectedAvatar}
        contentContainerStyle={[styles.selectedList, { minHeight: 80 }]}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            select the contacts below that you want to share this list
          </Text>
        )}
      />

      <Text style={styles.sectionTitle}>All contacts</Text>
      <FlatList
        data={allContacts}
        keyExtractor={item => item.id}
        renderItem={renderContact}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />

      <TouchableOpacity
        style={[styles.sendFab, { bottom: insets.bottom + 16 }]}
        onPress={() => router.push({ pathname: '/screens/ViewListScreen', params: { listName, items: JSON.stringify(parsedItems) } })}
      >
        <Icon name="check" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    height: 56,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 8 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: 'bold' },

  countText: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: '#666',
    fontSize: 14,
  },
  listInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  listName: { marginLeft: 8, fontSize: 18, fontWeight: '600', color: '#333' },

  sectionTitle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedList: {
    paddingLeft: 12,
    paddingBottom: 24,
    justifyContent: 'center',
  },

  avatarContainer: {
    width: 72,
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarName: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
  removeIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ccc',
    borderRadius: 8,
    padding: 2,
  },

  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
    fontStyle: 'italic',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  selectedRow: {
    backgroundColor: '#eef5fa',
  },
  avatarWrapper: { position: 'relative' },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  checkOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4b9941',
    borderRadius: 8,
    padding: 2,
  },
  contactName: { flex: 1, fontSize: 16, color: '#333' },

  sendFab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});



//  selectedList: { paddingLeft: 12, paddingBottom: 12 },

//  contentContainerStyle={styles.selectedList}

//  4b9941