// ViewListScreen.js
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import apiClient from '../services/apiClient';
import { getStoredSession } from '../services/authStorage';

const CREATOR_PHONE_NUMBER = '919876543210';

const parseSubQuantities = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse sub quantities', error);
    return [];
  }
};

export default function ViewListScreen() {
  const router = useRouter();
  const { listName: rawListName, listId: rawListId } = useLocalSearchParams();

  const listId = useMemo(() => {
    if (Array.isArray(rawListId)) {
      return rawListId[0];
    }
    return rawListId ?? null;
  }, [rawListId]);

  const fallbackTitle = useMemo(() => {
    if (Array.isArray(rawListName)) {
      return rawListName[0];
    }
    return rawListName ?? 'List';
  }, [rawListName]);

  const [listSummary, setListSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchList = useCallback(async () => {
    if (!listId) {
      setError('Missing list identifier.');
      setListSummary(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;

      const headers = userIdValue
        ? { 'X-User-Id': String(userIdValue) }
        : undefined;

      const { data } = await apiClient.get(
        `/api/lists/${encodeURIComponent(listId)}/creator/${CREATOR_PHONE_NUMBER}`,
        { headers },
      );

      const normalizedItems = Array.isArray(data?.items)
        ? data.items.map((item) => ({
            ...item,
            subQuantities: parseSubQuantities(item?.subQuantitiesJson),
          }))
        : [];

      setListSummary({
        ...data,
        items: normalizedItems,
      });
    } catch (err) {
      console.error('Failed to load list details', err);
      setError('Unable to load list items. Pull to refresh.');
      setListSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const listTitle = listSummary?.title ?? fallbackTitle;
  const listItems = listSummary?.items ?? [];

  const renderItem = ({ item }) => {
    const subQuantities = Array.isArray(item?.subQuantities)
      ? item.subQuantities
      : [];

    return (
    <View style={styles.itemContainer}>
      {/* Row 1: name + edit/delete */}
      <View style={styles.row1}>
        <Text style={styles.itemName}>{item.itemName ?? ''}</Text>
        <View style={styles.icons}>
         <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/screens/EditItemScreen',
                params: { item: JSON.stringify(item) },
              })
            }
          >
            <Icon name="edit" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { /* TODO: delete */ }} style={styles.iconSpacing}>
            <Icon name="delete" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: quantity on left, price on right */}
      <View style={styles.row2}>
        <Text style={styles.detailText}>{item.quantity ?? ''}</Text>
        <Text style={styles.detailText}>{item.priceText ?? ''}</Text>
      </View>

      {/* Sub‑quantities (indented) */}
      {subQuantities.map((sub, i) => (
        <View key={i} style={styles.subRow}>
          <Text style={styles.subText}>{sub.quantity}</Text>
          <Text style={styles.subText}>{sub.priceText}</Text>
        </View>
      ))}
    </View>
);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
           if (router.canGoBack()) router.back();
            else router.replace('/screens/MocScreen');
          }} style={styles.iconBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
            style={styles.titleContainer}
            onPress={() =>
              router.push({
                pathname: '/screens/ListInfoScreen',
                params: {
                  listName: listTitle,
                  description: listSummary?.description ?? '',
                  members: JSON.stringify(listSummary?.members ?? []),
                },
              })
            }
          >
            <Text style={styles.headerTitle}>{listTitle}</Text>
          </TouchableOpacity>
        <TouchableOpacity onPress={() => {/* TODO: more menu */}} style={styles.iconBtn}>
          <Icon name="more-vert" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* List items */}
      <FlatList
         data={listItems}
        keyExtractor={(item, idx) =>
          item?.id != null ? String(item.id) : idx.toString()
        }
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchList} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {error ?? 'No items in this list yet.'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#1f6ea7" />
            </View>
          ) : null
        }
      />
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

  titleContainer: {
  flex: 1,
  justifyContent: 'center',
   alignSelf: 'stretch',
},
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },

  list: {
    paddingVertical: 8,
  },
   loadingContainer: {
    paddingVertical: 24,
  },
  itemContainer: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  icons: {
    flexDirection: 'row',
  },
  iconSpacing: {
    marginLeft: 16,
  },

  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
  },

  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 24,
    marginTop: 4,
  },
  subText: {
    fontSize: 13,
    color: '#777',
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
});
