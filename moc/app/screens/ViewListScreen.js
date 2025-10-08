// ViewListScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
const formatPriceText = (priceText) => {
  if (priceText == null) {
    return '';
  }

  const normalized = String(priceText).trim();
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('₹') ? normalized : `₹${normalized}`;
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
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingItemId, setSavingItemId] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isTaskInputVisible, setIsTaskInputVisible] = useState(false);

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
      setEditingItemId(null);
      setEditingName('');
    } catch (err) {
      console.error('Failed to load list details', err);
      setError('Unable to load list items. Pull to refresh.');
      setListSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      fetchList();
    }, [fetchList]),
  );


  const listTitle = listSummary?.title ?? fallbackTitle;
  const listItems = listSummary?.items ?? [];
  const isPremiumList = listSummary?.listType === 'PREMIUM';
  const isBasicList = listSummary?.listType === 'BASIC';

  const startInlineEdit = useCallback(
    (item) => {
      const itemId = item?.id ?? null;
      if (!isPremiumList && itemId != null) {
        setEditingItemId(itemId);
        setEditingName(item?.itemName ?? '');
      }
    },
    [isPremiumList],
  );

  const cancelInlineEdit = useCallback(() => {
    setEditingItemId(null);
    setEditingName('');
  }, []);

  const handleInlineSave = useCallback(
    async (item) => {
      const itemId = item?.id ?? null;
      const trimmedName = editingName.trim();

      if (!trimmedName) {
        Alert.alert('Update item', 'Please enter a name for the item.');
        return;
      }

      if (!listId || itemId == null) {
        setListSummary((prev) => {
          if (!prev) {
            return prev;
          }
          const updatedItems = prev.items.map((existing) =>
            existing?.id === itemId ? { ...existing, itemName: trimmedName } : existing,
          );
          return { ...prev, items: updatedItems };
        });
        cancelInlineEdit();
        return;
      }

      try {
        setSavingItemId(itemId);
        const session = await getStoredSession();
        const userIdValue = session?.userId ? Number(session.userId) : null;
        const headers = userIdValue
          ? { 'X-User-Id': String(userIdValue) }
          : undefined;

        await apiClient.put(
          `/api/lists/${encodeURIComponent(listId)}/checklist/items/${encodeURIComponent(itemId)}`,
          { itemName: trimmedName },
          { headers },
        );

        setListSummary((prev) => {
          if (!prev) {
            return prev;
          }
          const updatedItems = prev.items.map((existing) =>
            existing?.id === itemId ? { ...existing, itemName: trimmedName } : existing,
          );
          return { ...prev, items: updatedItems };
        });
        cancelInlineEdit();
      } catch (inlineError) {
        console.error('Failed to update checklist item', inlineError);
        Alert.alert('Update failed', 'Unable to update the item. Please try again.');
      } finally {
        setSavingItemId(null);
      }
    },
    [cancelInlineEdit, editingName, listId],
  );

  const handleEditPress = useCallback(
    (item) => {
      if (isPremiumList) {
        router.push({
          pathname: '/screens/EditItemScreen',
          params: {
            item: JSON.stringify(item),
            listId: listId ? String(listId) : '',
          },
        });
      } else {
        startInlineEdit(item);
      }
    },
    [isPremiumList, listId, router, startInlineEdit],
  );

  const handleAddPremiumItem = useCallback(() => {
    if (!listId) {
      Alert.alert('Add item', 'Missing list identifier.');
      return;
    }

    router.push({
      pathname: '/screens/EditItemScreen',
      params: {
        listId: String(listId),
      },
    });
  }, [listId, router]);

  const handleAddTask = useCallback(async () => {
    const trimmedName = newTaskName.trim();
    if (!trimmedName) {
      Alert.alert('Add task', 'Please enter a task name.');
      return;
    }

    if (!listId) {
      setListSummary((prev) => {
        if (!prev) {
          return prev;
        }

        const temporaryId = Date.now();
        const appendedItems = [
          ...prev.items,
          {
            id: temporaryId,
            itemName: trimmedName,
            quantity: null,
            priceText: null,
            subQuantities: [],
          },
        ];

        return {
          ...prev,
          items: appendedItems,
        };
      });
      setNewTaskName('');
      setIsTaskInputVisible(false);
      return;
    }

    try {
      setIsAddingTask(true);
      const session = await getStoredSession();
      const userIdValue = session?.userId ? Number(session.userId) : null;
      const headers = userIdValue
        ? { 'X-User-Id': String(userIdValue) }
        : undefined;

      const { data } = await apiClient.post(
        `/api/lists/${encodeURIComponent(listId)}/checklist/items`,
        { itemName: trimmedName },
        { headers },
      );

      setListSummary((prev) => {
        if (!prev) {
          return prev;
        }

        const normalizedItem = data
          ? {
              ...data,
              itemName: data?.itemName ?? trimmedName,
              quantity: data?.quantity ?? null,
              priceText: data?.priceText ?? null,
              subQuantities: parseSubQuantities(data?.subQuantitiesJson),
            }
          : {
              id: Date.now(),
              itemName: trimmedName,
              quantity: null,
              priceText: null,
              subQuantities: [],
            };

        return {
          ...prev,
          items: [...prev.items, normalizedItem],
        };
      });
      setNewTaskName('');
      setIsTaskInputVisible(false);
    } catch (addError) {
      console.error('Failed to add task', addError);
      Alert.alert('Add task', 'Unable to add the task. Please try again.');
    } finally {
      setIsAddingTask(false);
    }
  }, [listId, newTaskName]);

    const handleBeginAddTask = useCallback(() => {
    setIsTaskInputVisible(true);
  }, []);

  const handleCancelNewTask = useCallback(() => {
    if (isAddingTask) {
      return;
    }
    setIsTaskInputVisible(false);
    setNewTaskName('');
  }, [isAddingTask]);

  const performDelete = useCallback(
    async (itemId) => {
      if (itemId == null) {
        return;
      }

      if (!listId) {
        setListSummary((prev) => {
          if (!prev) {
            return prev;
          }

          const filteredItems = prev.items.filter(
            (existing) => existing?.id !== itemId,
          );
          return { ...prev, items: filteredItems };
        });
        return;
      }

      try {
        setDeletingItemId(itemId);
        const session = await getStoredSession();
        const userIdValue = session?.userId ? Number(session.userId) : null;
        const headers = userIdValue
          ? { 'X-User-Id': String(userIdValue) }
          : undefined;

        const encodedListId = encodeURIComponent(listId);
        const encodedItemId = encodeURIComponent(itemId);

        const endpoint = isPremiumList
          ? `/api/lists/${encodedListId}/items/${encodedItemId}`
          : `/api/lists/${encodedListId}/checklist/items/${encodedItemId}`;

        await apiClient.delete(endpoint, { headers });

        setListSummary((prev) => {
          if (!prev) {
            return prev;
          }

          const filteredItems = prev.items.filter(
            (existing) => existing?.id !== itemId,
          );
          return { ...prev, items: filteredItems };
        });
      } catch (deleteError) {
        console.error('Failed to delete item', deleteError);
        Alert.alert('Delete failed', 'Unable to delete the item. Please try again.');
      } finally {
        setDeletingItemId(null);
      }
    },
    [isPremiumList, listId],
  );

  const handleDeletePress = useCallback(
    (item) => {
      const itemId = item?.id ?? null;

      if (itemId == null) {
        return;
      }

      Alert.alert(
        'Delete item',
        'This item will be permanently removed and will not be shown again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              performDelete(itemId);
            },
          },
        ],
      );
    },
    [performDelete],
  );


  const renderItem = ({ item }) => {
    const subQuantities = Array.isArray(item?.subQuantities)
      ? item.subQuantities
      : [];
    const hasQuantity =
      item?.quantity != null && String(item.quantity).trim() !== '';
    const hasPriceText =
      isPremiumList && item?.priceText != null && String(item.priceText).trim() !== '';

    const showDetailsRow = isPremiumList && (hasQuantity || hasPriceText);
    const displayPriceText = hasPriceText ? formatPriceText(item.priceText) : '';
    const itemId = item?.id ?? null;
    const isEditing = !isPremiumList && editingItemId === itemId;
    const isSaving = savingItemId === itemId;
    return (
   <View style={styles.itemContainer}>
        {/* Row 1: name + edit/delete */}
        <View style={styles.row1}>
          {isEditing ? (
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              style={styles.inlineInput}
              autoFocus
              editable={!isSaving}
            />
          ) : (
            <Text style={styles.itemName}>{item.itemName ?? ''}</Text>
          )}
          <View style={styles.icons}>
            {isEditing ? (
              <>
                <TouchableOpacity
                  onPress={() => handleInlineSave(item)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#1f6ea7" />
                  ) : (
                    <Icon name="check" size={20} color="#1f6ea7" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={cancelInlineEdit}
                  style={styles.iconSpacing}
                  disabled={isSaving}
                >
                  <Icon name="close" size={20} color="#d00" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => handleEditPress(item)}>
                  <Icon name="edit" size={20} color="#333" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePress(item)}
                  style={styles.iconSpacing}
                  disabled={deletingItemId === itemId}
                >
                 {deletingItemId === itemId ? (
                    <ActivityIndicator size="small" color="#d00" />
                  ) : (
                    <Icon name="delete" size={20} color="#333" />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

      {/* Row 2: quantity on left, price on right */}
        {showDetailsRow ? (
          <View style={styles.row2}>
            <Text style={styles.detailText}>{item.quantity ?? ''}</Text>
            <Text style={styles.detailText}>{displayPriceText}</Text>
          </View>
        ) : null}

        {/* Sub‑quantities (indented) */}
        {isPremiumList
          ? subQuantities.map((sub, i) => (
              <View key={i} style={styles.subRow}>
                <Text style={styles.subText}>{sub.quantity}</Text>
                <Text style={styles.subText}>{formatPriceText(sub.priceText)}</Text>
              </View>
            ))
          : null}
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
        ListFooterComponent={() => (
          <View style={styles.footerContainer}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#1f6ea7" />
              </View>
            ) : null}
            {!isLoading && isPremiumList ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddPremiumItem}
              >
                <Text style={styles.addButtonText}>Add item</Text>
              </TouchableOpacity>
            ) : null}
            {!isLoading && isBasicList ? (
              <View style={styles.addTaskContainer}>
                 {isTaskInputVisible ? (
                  <>
                    <TextInput
                      style={styles.addTaskInput}
                      placeholder="Describe the task"
                      placeholderTextColor="#777"
                      value={newTaskName}
                      onChangeText={setNewTaskName}
                      editable={!isAddingTask}
                      multiline
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={handleAddTask}
                    />
                    <View style={styles.taskActionsRow}>
                      <TouchableOpacity
                        style={[styles.addTaskButton, styles.addTaskButtonFullWidth]}
                        onPress={handleAddTask}
                        disabled={isAddingTask}
                      >
                        {isAddingTask ? (
                          <ActivityIndicator size="small" color="#1f6ea7" />
                        ) : (
                          <Text style={styles.addTaskButtonText}>Save task</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelTaskButton}
                        onPress={handleCancelNewTask}
                        disabled={isAddingTask}
                      >
                        <Text style={styles.cancelTaskButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.addTaskButton}
                    onPress={handleBeginAddTask}
                  >
                    <Text style={styles.addTaskButtonText}>Add task</Text>
                </TouchableOpacity>
                 )}
              </View>
            ) : null}
          </View>
        )}
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
  footerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
   inlineInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    borderBottomWidth: 1,
    borderColor: '#1f6ea7',
    paddingVertical: 0,
    marginRight: 8,
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
   addButton: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f6ea7',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#1f6ea7',
    fontSize: 16,
    fontWeight: '600',
  },
  addTaskContainer: {
    marginTop: 12,
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 12,
  },
  addTaskInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d7de',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
     minHeight: 60,
  },
  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  addTaskButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f6ea7',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTaskButtonFullWidth: {
    flex: 1,
  },
  addTaskButtonText: {
    color: '#1f6ea7',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelTaskButton: {
    marginLeft: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelTaskButtonText: {
    color: '#1f6ea7',
    fontSize: 15,
    fontWeight: '500',
  },
});
