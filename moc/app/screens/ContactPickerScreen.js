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
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useChatRegistry } from '../context/ChatContext';
import { normalizePhoneNumber } from '../services/contactService';
import {
  getAllContactsFromDb,
  saveContactsToDb,
  searchContactsInDb,
} from '../services/contactStorage';
import { createDirectRoom } from '../services/roomsService';


export default function ContactPickerScreen() {
  console.log('[CONTACT_PICKER] render');
  
  
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

  const mapStoredContactToUi = useCallback(
    stored => ({
      id: stored.id ?? `db-contact-${Math.random().toString(36).slice(2)}`,
      name: stored.name ?? 'Unknown contact',
      phoneNumbers: (stored.phoneNumbers ?? []).map((phone, idx) => ({
        id: `${stored.id ?? 'unknown'}-${idx}`,
        label: phone.label ?? undefined,
        number: phone.number,
      })),
      imageAvailable: Boolean(stored.imageUri),
      image: stored.imageUri ? { uri: stored.imageUri } : undefined,
    }),
    [],
  );

  const extractMatchesFromStored = useCallback(storedContacts => {
    const dedup = new Map();

    storedContacts.forEach(contact => {
      if (contact.matchPhone && contact.matchUserId != null) {
        const key = normalizePhoneNumber(contact.matchPhone) ?? contact.matchPhone;
        if (key && !dedup.has(key)) {
          dedup.set(key, { phone: contact.matchPhone, userId: Number(contact.matchUserId) });
        }
      }
    });

    return Array.from(dedup.values());
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreCachedContacts = async () => {
      try {
        const cached = await getAllContactsFromDb();

        if (!isMounted || !cached?.length) {
          return;
        }

        // Pull existing rows from SQLite so our initial render mirrors disk state.
        setContacts(curr => (curr?.length ? curr : cached.map(mapStoredContactToUi)));
        setMatchedContacts(currMatches => (currMatches?.length ? currMatches : extractMatchesFromStored(cached)));
      } catch (error) {
        console.warn('Unable to restore cached contacts', error);
      }
    };

    restoreCachedContacts();

    return () => {
      isMounted = false;
    };
  }, [extractMatchesFromStored, mapStoredContactToUi]);


  const matchesByPhone = useMemo(() => {
    const map = new Map();

     const addEntry = (key, match) => {
      if (key && !map.has(key)) {
        map.set(key, match);
      }
    };

    matchedContacts.forEach(match => {
     const rawPhone = match?.phone?.trim?.() ?? '';
      if (!rawPhone) {
        return;
      }

      // Store raw value straight from the server
      addEntry(rawPhone, match);

      const normalized = normalizePhoneNumber(rawPhone);
      if (normalized) {
        addEntry(normalized, match);

        const normalizedDigits = normalized.replace(/\D/g, '');
        addEntry(normalizedDigits, match);

        if (normalizedDigits.startsWith('91') && normalizedDigits.length === 12) {
          addEntry(normalizedDigits.slice(2), match);;
        }
      }

      // Also store digits-only fallbacks so we can match contacts saved without country codes
      const digitsOnly = rawPhone.replace(/\D/g, '');
      addEntry(digitsOnly, match);
      if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
        addEntry(digitsOnly.slice(2), match);
      }
    });
    return map;
  }, [matchedContacts]);

  const getMatchForContact = useCallback(
    contact => {
      const numbers = contact?.phoneNumbers ?? [];

      for (const phone of numbers) {
        const rawNumber = phone?.number ?? '';
        if (!rawNumber) {
          continue;
        }

        const normalized = normalizePhoneNumber(rawNumber);
        const digitsOnly = rawNumber.replace(/\D/g, '');

        const candidates = [];

        if (normalized) {
          candidates.push(normalized);

          const normalizedDigits = normalized.replace(/\D/g, '');
          if (normalizedDigits) {
            candidates.push(normalizedDigits);

            if (normalizedDigits.startsWith('91') && normalizedDigits.length === 12) {
              candidates.push(normalizedDigits.slice(2));
            }
          }
        }

        if (digitsOnly) {
          candidates.push(digitsOnly);

          if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
            candidates.push(digitsOnly.slice(1));
          }

          if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
            candidates.push(digitsOnly.slice(2));
          }
        }

        for (const key of candidates) {
          if (matchesByPhone.has(key)) {
            return matchesByPhone.get(key);
          }
        }
      }
      return null;
    },
    [matchesByPhone],
  );

  const refreshContactsFromDb = useCallback(
    async (queryText = '') => {
      try {
        const stored = queryText ? await searchContactsInDb(queryText) : await getAllContactsFromDb();
        setContacts(stored.map(mapStoredContactToUi));
        setMatchedContacts(extractMatchesFromStored(stored));
      } catch (error) {
        console.warn('Unable to refresh contacts from SQLite', error);
      }
    },
    [extractMatchesFromStored, mapStoredContactToUi],
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
        setContacts(current => (current?.length ? current : []));
        setMatchedContacts(current => (current?.length ? current : []));
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

      try {
        setIsSyncing(true);
        const matches = await saveContactsToDb(loaded);
        setMatchedContacts(matches);
        await refreshContactsFromDb('');
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
  }, [refreshContactsFromDb]);

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

  
  useEffect(() => {
    // Re-query SQLite whenever the search input stabilizes so new synced rows show up mid-search.
    refreshContactsFromDb(searchQuery);
  }, [refreshContactsFromDb, searchQuery]);

  const filteredContacts = useMemo(() => contacts, [contacts]);
  
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

    const numericQuery = searchQuery.replace(/\D/g, '');

    const hasExistingContact = filteredContacts.some(contact =>
      (contact.phoneNumbers ?? []).some(phone => {
        const normalized = phone?.number?.replace(/\D/g, '') ?? '';
        return numericQuery && normalized.includes(numericQuery);
      }),
    );

    const virtualContact =
      !filteredContacts.length && numericQuery.length >= 7 && !hasExistingContact
        ? {
            id: `virtual-${numericQuery}`,
            name: searchQuery,
            phoneNumbers: [
              {
                id: `virtual-${numericQuery}-phone`,
                label: 'mobile',
                number: searchQuery,
              },
            ],
            imageAvailable: false,
            image: undefined,
          }
        : null;

    if (filteredContacts.length) {
      return filteredContacts;
    }

    return virtualContact ? [virtualContact] : [];
  }, [filteredContacts, searchQuery]);

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

    const primaryNumber = contact?.phoneNumbers?.[0]?.number ?? match?.phone ?? '';
    const displayName = contact?.name?.trim?.() || primaryNumber || match?.phone || 'Unknown contact';

    const statusText = match
      ? `${primaryNumber || match.phone} · On MoC`
      : primaryNumber || 'No phone number';

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
          <Text style={styles.searchResultName}>{displayName}</Text>
          <Text style={styles.searchResultStatus}>{statusText}</Text>
        </View>
        {isSel && <Icon name="check-circle" size={22} color="#1f6ea7" />}
      </TouchableOpacity>
    );
  };

  const DebugInfo = () => (
    <View style={styles.debugInfo}>
      <Text style={styles.debugText}>
        {`input="${searchInput}" | query="${searchQuery}" | filtered=${filteredContacts.length} | contacts=${contacts.length}`}
      </Text>
      <Text style={styles.debugText}>
        {`matches=${matchedContacts.length} | permission=${permissionStatus} | loading=${isLoadingContacts}`}
      </Text>
      {contactsError ? <Text style={[styles.debugText, styles.debugError]}>{contactsError}</Text> : null}
      {syncError ? <Text style={[styles.debugText, styles.debugError]}>{syncError}</Text> : null}
      <Text/>
    </View>
  );

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
      <DebugInfo />

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

{isSearching && searchInput  ? (
        <View style={styles.searchResultsWrapper}>
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsLabel}>Contacts</Text>
            <Text style={styles.searchResultsCount}>
              {searchResults.length ? `${searchResults.length} found` : 'No matches'}
            </Text>
          </View>

          {searchResults.length ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              {searchResults.map(renderSearchResult)}
            </ScrollView>
          ) : (
            <View style={styles.emptySearchWrapper}>
              <Icon name="search" size={36} color="#999" />
              <Text style={styles.emptySearchTitle}>No MoC contacts found</Text>
              <Text style={styles.emptySearchMessage}>
                Try a different name or number to find people already using MoC.
              </Text>
               {isLoadingContacts ? (
                <Text style={styles.emptySearchHint}>Still loading contacts from your phone…</Text>
              ) : contactsError ? (
                <Text style={styles.emptySearchHint}>{contactsError}</Text>
              ) : syncError ? (
                <Text style={styles.emptySearchHint}>{syncError}</Text>
              ) : null}
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

  debugInfo: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#b3261e',
  },
  debugError: {
    fontWeight: '600',
  },


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
  emptySearchHint: {
    fontSize: 13,
    color: '#b3261e',
    textAlign: 'center',
    marginTop: 8,
  },
});
