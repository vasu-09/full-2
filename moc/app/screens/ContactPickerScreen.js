// screens/ContactPickerScreen.js
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useChatRegistry } from '../context/ChatContext';
import { normalizePhoneNumber, syncContacts } from '../services/contactService';
import { createDirectRoom } from '../services/roomsService';


export default function ContactPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { upsertRoom } = useChatRegistry();

  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [matchedContacts, setMatchedContacts] = useState([]);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const matchesByPhone = useMemo(() => {
    const map = new Map();
    matchedContacts.forEach(match => {
      if (match?.phone) {
        map.set(match.phone, match);
      }
    });
    return map;
  }, [matchedContacts]);

  const getMatchForContact = useCallback(
    contact => {
      const numbers = contact?.phoneNumbers ?? [];
      for (const phone of numbers) {
        const normalized = phone?.number ? normalizePhoneNumber(phone.number) : null;
        if (normalized && matchesByPhone.has(normalized)) {
          return matchesByPhone.get(normalized);
        }
      }
      return null;
    },
    [matchesByPhone],
  );

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      });
      setContacts(data);
       try {
        setSyncError('');
        setIsSyncing(true);
        const matches = await syncContacts(data);
        setMatchedContacts(matches);
      } catch (error) {
        console.error('Failed to sync contacts', error);
        setSyncError('Unable to sync contacts with MoC right now.');
      } finally {
        setIsSyncing(false);
      }
    })();
  }, []);

  const toggleSelect = contact => {
    setCreateError('');
    const match = getMatchForContact(contact);
    if (!match) {
      setCreateError('Selected contact has not joined MoC yet.');
      return;
    }
    setSelected(curr => (curr.some(c => c.id === contact.id) ? [] : [contact]));
  };

  const handleSend = async () => {
    if (!selected.length) {
      return;
    }
    const contact = selected[0];
    const match = getMatchForContact(contact);
    if (!match) {
      setCreateError('Please choose a contact who already uses MoC.');
      return;
    }

    try {
      setCreateError('');
      setIsCreating(true);
      const room = await createDirectRoom(match.userId);
      upsertRoom({
        id: room.id,
        roomKey: room.roomId,
        title: contact?.name ?? match.phone,
        avatar: contact?.imageAvailable ? contact?.image?.uri ?? null : null,
        peerId: match.userId,
      });
      router.replace({
        pathname: '/screens/ChatDetailScreen',
        params: {
          roomId: String(room.id),
          roomKey: room.roomId,
          title: contact?.name ?? match.phone,
          peerId: String(match.userId),
        },
      });
    } catch (err) {
      console.error('Failed to start conversation', err);
      setCreateError('Unable to start a conversation right now. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery) {
      return contacts;
    }
    const lower = searchQuery.toLowerCase();
    return contacts.filter(c => c.name?.toLowerCase().includes(lower));
  }, [contacts, searchQuery]);


  const renderItem = ({ item }) => {
    const isSel = selected.some(c => c.id === item.id);
    const match = getMatchForContact(item);
    const statusLabel = match ? 'On MoC' : 'Invite';
    return (
      <TouchableOpacity onPress={() => toggleSelect(item)} style={styles.item}>
        {item.imageAvailable ? (
          <Image source={{ uri: item.image.uri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Icon name="person" size={24} color="#888" />
          </View>
        )}
        <View style={styles.itemTextWrapper}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={[styles.statusLabel, match ? styles.statusAvailable : styles.statusUnavailable]}>
            {statusLabel}
          </Text>
        </View>
        {isSel && <Icon name="check-circle" size={24} color="#1f6ea7" />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ◀️ Conditional header */}
      {isSearching ? (
        <View style={[styles.searchHeader, { paddingTop: insets.top }]}>
    <TouchableOpacity
      onPress={() => setIsSearching(false)}
      style={styles.searchBackBtn}
    >
      <Icon name="arrow-back" size={24} color="#1f6ea7" />
    </TouchableOpacity>
    <TextInput
      style={styles.searchHeaderInput}
      placeholder="Search contacts"
      placeholderTextColor="#999"
      value={searchInput}
      onChangeText={setSearchInput}
      autoFocus
      underlineColorAndroid="transparent"
    />
  </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top }]}>
    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
      <Icon name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>

    {/* Title + subtitle stacked on the left */}
    <View style={styles.titleContainer}>
      <Text style={styles.title}>contacts to send</Text>
      <Text style={styles.subtitle}>{selected.length} selected</Text>
    </View>

     <TouchableOpacity onPress={() => { setIsSearching(true); setSearchInput(''); setSearchQuery(''); }} style={styles.searchBtn}>
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
  </View>

        
      )}

      {/* Selected strip (unchanged) */}
      {selected.length > 0 && (
        <View style={styles.selectedWrapper}>
          <Text style={styles.sectionTitle}>Selected contacts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedList}
            contentContainerStyle={{ paddingHorizontal: 8 }}
          >
            {selected.map(c => (
              <View key={c.id} style={styles.selectedItem}>
                {c.imageAvailable ? (
                  <Image source={{ uri: c.image.uri }} style={styles.selectedAvatar} />
                ) : (
                  <View style={[styles.selectedAvatar, styles.placeholder]}>
                    <Icon name="person" size={20} color="#888" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => toggleSelect(c)}
                >
                  <Icon name="close" size={14} color="#666" />
                </TouchableOpacity>
                <Text style={styles.selectedName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* All contacts */}
      <Text style={styles.sectionTitle}>All contacts</Text>
      <View style={styles.syncStatusWrapper}>
        {isSyncing ? (
          <Text style={styles.syncStatusText}>Syncing your contacts…</Text>
        ) : syncError ? (
          <Text style={[styles.syncStatusText, styles.syncStatusError]}>{syncError}</Text>
        ) : matchedContacts.length > 0 ? (
          <Text style={styles.syncStatusText}>
            {matchedContacts.length} of your contacts are already on MoC.
          </Text>
        ) : (
          <Text style={styles.syncStatusText}>None of your contacts have joined MoC yet.</Text>
        )}
      </View>
      {createError ? (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>{createError}</Text>
        </View>
      ) : null}
      <FlatList
        data={filteredContacts}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />

      {/* Floating Send button */}
      {selected.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, isCreating && styles.fabDisabled, { bottom: insets.bottom + 16 }]}
          onPress={handleSend}
          disabled={isCreating}
        >
          {isCreating ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={24} color="#fff" />}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef5fa' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f6ea7',
    paddingHorizontal: 8,
    height: 56,
    // remove fixed height so it can grow with two lines
  },

  backBtn: { padding: 8 },
  sendBtn: { padding: 8 },

  titleContainer: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 8,
  },

  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  // NORMAL header
  
  searchBtn: { padding: 8 },

  // SEARCH header replaces the normal header
 selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    marginTop: 8,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    marginTop: 12,
    marginBottom: 4,
  },

  selectedWrapper: {
    backgroundColor: '#f5f9ff',
    paddingVertical: 8,
  },
  selectedList: { height: 80 },
  selectedItem: {
    width: 60,
    alignItems: 'center',
    marginRight: 12,
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 2,
    elevation: 2,
  },
  selectedName: {
    fontSize: 12,
    textAlign: 'center',
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  placeholder: {
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
 itemTextWrapper: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
  },
  statusLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statusAvailable: {
    color: '#2e7d32',
  },
  statusUnavailable: {
    color: '#888',
  },

  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1f6ea7',
    borderRadius: 28,
    padding: 16,
    elevation: 4,
  },
  fabDisabled: {
    backgroundColor: '#7aa3c3',
  },

 syncStatusWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  syncStatusText: {
    fontSize: 14,
    color: '#4a4a4a',
  },
  syncStatusError: {
    color: '#b3261e',
  },

  errorWrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#b3261e',
    fontSize: 13,
  },

  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    height: 56,              // standard appbar height
  },

  // smaller hit area for the back arrow pill
  searchBackBtn: {
    padding: 8,
  },

  // full‑width, flat input
  searchHeaderInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 18,
    color: '#333',
    paddingVertical: 8,
  },
});
