// screens/ContactPickerScreen.js
import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  SectionList,
  Share,
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
  const [contactsError, setContactsError] = useState('');
  const [matchedContacts, setMatchedContacts] = useState([]);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [canAskPermission, setCanAskPermission] = useState(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  const matchesByPhone = useMemo(() => {
    const map = new Map();
    matchedContacts.forEach(match => {
    const rawPhone = match?.phone;
      if (!rawPhone) {
        return;
      }

      map.set(rawPhone, match);

      const normalized = normalizePhoneNumber(rawPhone);
      if (normalized) {
        map.set(normalized, match);

        if (normalized.startsWith('91') && normalized.length === 12) {
          map.set(normalized.slice(2), match);
        }
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

 const loadContacts = useCallback(async () => {
    setContactsError('');
    setSyncError('');
    setIsLoadingContacts(true);
    setIsSyncing(false);

    try {
      const { status, granted, canAskAgain } = await Contacts.requestPermissionsAsync();
      setPermissionStatus(status);
      setCanAskPermission(Boolean(canAskAgain));

      if (!granted) {
        setContacts([]);
        setMatchedContacts([]);
        if (status === 'denied') {
          setContactsError('MoC needs access to your contacts to show them here.');
        }
        return;
      }

      const loaded = [];
      let pageOffset = 0;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
          sort: Contacts.SortTypes.FirstName,
          pageSize: 200,
          pageOffset,
        });

        loaded.push(...response.data);
        hasNextPage = response.hasNextPage;
        pageOffset += response.data.length;
      }

      setContacts(loaded);

      try {
        setIsSyncing(true);
        const matches = await syncContacts(loaded);
        setMatchedContacts(matches);
      } catch (error) {
        console.error('Failed to sync contacts', error);
        setSyncError('Unable to sync contacts with MoC right now.');
      } finally {
        setIsSyncing(false);
      }
    } catch (error) {
      console.error('Failed to load contacts from device', error);
      setContacts([]);
      setMatchedContacts([]);
      setContactsError('Unable to read contacts from your device.');
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

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
   const numericQuery = searchQuery.replace(/\D/g, '');

    return contacts.filter(contact => {
      const nameMatch = contact.name?.toLowerCase().includes(lower);

      const phoneMatch = (contact.phoneNumbers ?? []).some(phone => {
        const rawNumber = phone?.number ?? '';
        const normalizedNumber = rawNumber.replace(/\D/g, '');

        if (!rawNumber) {
          return false;
        }

        return (
          rawNumber.toLowerCase().includes(lower) ||
          (!!numericQuery && normalizedNumber.includes(numericQuery))
        );
      });

      return nameMatch || phoneMatch;
    });
  }, [contacts, searchQuery]);

  const contactSections = useMemo(() => {
    const registered = [];
    const unregistered = [];

    filteredContacts.forEach(contact => {
      if (getMatchForContact(contact)) {
        registered.push(contact);
      } else {
        unregistered.push(contact);
      }
    });

    const sections = [];
    if (registered.length) {
      sections.push({ title: 'On MoC', data: registered, type: 'registered' });
    }
    if (unregistered.length) {
      sections.push({ title: 'Invite to MoC', data: unregistered, type: 'unregistered' });
    }
    return sections;
  }, [filteredContacts, getMatchForContact]);

  const searchResults = useMemo(() => {
    if (!searchQuery) {
      return [];
    }

    return filteredContacts.filter(contact => Boolean(getMatchForContact(contact)));
  }, [filteredContacts, getMatchForContact, searchQuery]);

  const handleInvite = useCallback(async contact => {
    const displayName = contact?.name?.trim();
    const inviteMessage = displayName
      ? `Hey ${displayName}, I'm using MoC to stay connected. Download the app and join me!`
      : `I'm using MoC to stay connected. Download the app and join me!`;

    try {
      await Share.share({ message: inviteMessage });
    } catch (error) {
      console.warn('Unable to open invite share sheet', error);
    }
  }, []);



  const renderItem = ({ item }) => {
    const isSel = selected.some(c => c.id === item.id);
    const match = getMatchForContact(item);
     const statusLabel = match ? 'On MoC' : 'Not on MoC yet';
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
        <View style={styles.itemRight}>
          {match ? (
            isSel && <Icon name="check-circle" size={24} color="#1f6ea7" />
          ) : (
            <TouchableOpacity style={styles.inviteButton} onPress={() => handleInvite(item)}>
              <Text style={styles.inviteButtonText}>Invite</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = contact => {
    const isSel = selected.some(c => c.id === contact.id);
    const match = getMatchForContact(contact);

    return (
      <TouchableOpacity key={contact.id} style={styles.searchResultItem} onPress={() => toggleSelect(contact)}>
        {contact.imageAvailable ? (
          <Image source={{ uri: contact.image.uri }} style={styles.searchResultAvatar} />
        ) : (
          <View style={[styles.searchResultAvatar, styles.placeholder]}>
            <Icon name="person" size={22} color="#888" />
          </View>
        )}
        <View style={styles.searchResultText}>
          <Text style={styles.searchResultName}>{contact.name}</Text>
          <Text style={styles.searchResultStatus}>{match?.phone}</Text>
        </View>
        {isSel && <Icon name="check-circle" size={22} color="#1f6ea7" />}
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

{isSearching && searchQuery ? (
        <View style={styles.searchResultsWrapper}>
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsLabel}>Contacts</Text>
            <Text style={styles.searchResultsCount}>
              {searchResults.length ? `${searchResults.length} found` : 'No matches'}
            </Text>
          </View>

          {searchResults.length ? (
            searchResults.map(renderSearchResult)
          ) : (
            <View style={styles.emptySearchWrapper}>
              <Icon name="search" size={36} color="#999" />
              <Text style={styles.emptySearchTitle}>No MoC contacts found</Text>
              <Text style={styles.emptySearchMessage}>
                Try a different name or number to find people already using MoC.
              </Text>
            </View>
          )}
        </View>
      ) : (
         <>
          {/* All contacts */}
          <Text style={styles.sectionTitle}>All contacts</Text>
          <View style={styles.syncStatusWrapper}>
            {isLoadingContacts ? (
              <Text style={styles.syncStatusText}>Loading contacts from your phone…</Text>
            ) : contactsError ? (
              <Text style={[styles.syncStatusText, styles.syncStatusError]}>{contactsError}</Text>
            ) : isSyncing ? (
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
          {permissionStatus !== 'granted' ? (
            <View style={styles.permissionWrapper}>
              <Icon name="contacts" size={42} color="#1f6ea7" />
              <Text style={styles.permissionTitle}>Contacts permission needed</Text>
              <Text style={styles.permissionMessage}>
                Allow MoC to access your address book so we can show who is already using the app and who you can
                invite.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => {
                  if (permissionStatus === 'denied' && !canAskPermission) {
                    Linking.openSettings();
                  } else {
                    loadContacts();
                  }
                }}
              >
                <Text style={styles.permissionButtonText}>
                  {permissionStatus === 'denied' && !canAskPermission ? 'Open settings' : 'Allow contact access'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SectionList
              sections={contactSections}
              keyExtractor={c => c.id}
              renderItem={renderItem}
              renderSectionHeader={({ section }) => (
                <Text style={styles.sectionDivider}>{section.title}</Text>
              )}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              ListEmptyComponent={
                !isLoadingContacts && (
                  <View style={styles.emptyStateWrapper}>
                    <Text style={styles.emptyStateText}>No contacts found on this device.</Text>
                    <TouchableOpacity style={styles.permissionButton} onPress={loadContacts}>
                      <Text style={styles.permissionButtonText}>Reload contacts</Text>
                    </TouchableOpacity>
                  </View>
                )
              }
            />
          )}
          </>
      )}

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

  sectionDivider: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f6ea7',
    marginHorizontal: 12,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  
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
  itemRight: {
    marginLeft: 12,
  },

  inviteButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f6ea7',
  },
  inviteButtonText: {
    color: '#1f6ea7',
    fontWeight: '600',
    fontSize: 13,
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

  permissionWrapper: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
    color: '#1f1f1f',
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 16,
    backgroundColor: '#1f6ea7',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyStateWrapper: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
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
  searchResultsWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  searchResultsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  searchResultsCount: {
    fontSize: 13,
    color: '#666',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  searchResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#ddd',
  },
  searchResultText: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  searchResultStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptySearchWrapper: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    color: '#1f1f1f',
  },
  emptySearchMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
});
