// ListsScreen.js
import { useRouter } from 'expo-router';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';


const HEADER_HEIGHT = 56;

const bgColors = ['#1f6ea7', '#64792A', '#E6A23C', '#67C23A', '#909399'];

export default function ListsScreen() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);

  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;

      if (!userIdValue) {
        setLists([]);
        setError('Please sign in again to load your lists.');
        return;
      }

      const { data } = await apiClient.get('/api/lists/created', {
        headers: { 'X-User-Id': String(userIdValue) },
      });

      if (Array.isArray(data)) {
        setLists(data);
      } else {
        setLists([]);
      }
    } catch (err) {
      console.error('Failed to load lists', err);
      setError('Unable to load lists. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const listCountLabel = useMemo(() => {
    if (!hasLoaded && isLoading) {
      return 'Loading…';
    }

    const count = lists.length;
    return `${count} ${count === 1 ? 'list' : 'lists'}`;
  }, [hasLoaded, isLoading, lists.length]);
  
  const renderListItem = ({ item, index }) => {
    const bg = bgColors[index % bgColors.length];
     const title = item?.title || item?.name || 'Untitled List';
    const listId = item?.id != null ? String(item.id) : undefined;
    return (
        <TouchableOpacity
        style={styles.listItem}
        onPress={() => router.push({
          pathname: '/screens/ViewListScreen',
          params: {
            listName: title,
            listId,
          },
        })}
      >
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Icon name="shopping-cart" size={24} color="#fff" />
        </View>
        <Text style={styles.listName}>{title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            router.replace('/screens/MocScreen');
          }}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Select List</Text>
         <Text style={styles.headerSubtitle}>{listCountLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Icon name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* New List */}
      <View style={styles.newListContainer}><TouchableOpacity
          style={styles.newListBtn}
          onPress={() => router.push('/screens/NewListScreen')}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#1f6ea7' }]}>
            <Icon name="playlist-add" size={24} color="#fff" />
          </View>
          <Text style={styles.newListTitle}>New list</Text>
        </TouchableOpacity>
      </View>

      {/* Section header */}
      <Text style={styles.sectionTitle}>Lists you have on MoC</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Existing Lists */}
      <FlatList
        data={lists}
        keyExtractor={(item, index) => {
          const id = item?.id;
          return id != null ? String(id) : `list-${index}`;
        }}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
         refreshControl={(
          <RefreshControl refreshing={isLoading} onRefresh={fetchLists} />
        )}
        ListEmptyComponent={
          hasLoaded && !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No lists yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a new list to get started.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  iconBtn: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 4,
    justifyContent:'center'
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#e0f2ff',
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },

  newListContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    // no border here
  },
  newListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newListTitle: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  sectionTitle: {
    marginTop: 12,
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  listContainer: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    marginHorizontal: 12,
    marginTop: 6,
    color: '#d9534f',
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});
