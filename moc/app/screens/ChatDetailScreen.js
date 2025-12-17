// ChatDetailScreen.js
import { Audio } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useCallSignalingHook from '../hooks/useCallSignaling';
import { useChatSession } from '../hooks/useChatSession';
import apiClient from '../services/apiClient';

const BAR_HEIGHT = 56;
const MESSAGE_BAR_HEIGHT = 48;
const MARGIN = 8;
const MIC_SIZE = 48;


export const formatDurationText = millis => {
  const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const MessageContent = ({ item, playingMessageId, onTogglePlayback, onRetryDecrypt }) => {
  const [overrideText, setOverrideText] = useState(null);
  const [retryStatus, setRetryStatus] = useState('idle');

  useEffect(() => {
    setOverrideText(null);
    setRetryStatus('idle');
  }, [item.id]);

  useEffect(() => {
    if (overrideText && item.text && !item?.raw?.decryptionFailed) {
      setOverrideText(null);
    }
  }, [item.text, item?.raw?.decryptionFailed, overrideText]);

  useEffect(() => {
    const shouldRetry = Boolean(onRetryDecrypt) && Boolean(item.failed || item?.raw?.decryptionFailed);
    if (!shouldRetry) {
      return undefined;
    }

    let cancelled = false;
    setRetryStatus('retrying');
    onRetryDecrypt(item)
      .then(result => {
        if (cancelled) return;
        if (result) {
          setOverrideText(result);
          setRetryStatus('idle');
        } else {
          setRetryStatus('failed');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRetryStatus('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.failed, item?.raw?.decryptionFailed, onRetryDecrypt]);

  const showRetryStatus = retryStatus === 'failed' && Boolean(item.failed || item?.raw?.decryptionFailed);
  const fallbackText = item.text ?? item?.raw?.body ?? 'Encrypted message';
  const messageText = overrideText ?? fallbackText;
  const statusColor = item.failed
    ? '#b3261e'
    : item.pending
      ? '#1f6ea7'
      : item.sender === 'me'
        ? '#555'
        : '#777';
  const showClock = item.pending || item.failed;
  const decryptionFailed = Boolean(item?.raw?.decryptionFailed);
  return (
    <View style={styles.messageContentRow}>
      {item.audio ? (
        <View style={[styles.audioMessageRow, styles.messageTextFlex]}>
          <TouchableOpacity
            style={styles.audioPlayButton}
            onPress={() => onTogglePlayback(item)}
            disabled={item.pending || item.failed}
          >
            <Icon
              name={playingMessageId === item.id ? 'pause' : 'play-arrow'}
              size={28}
              color="#1f6ea7"
            />
          </TouchableOpacity>
          <Text style={styles.audioDurationText}>{formatDurationText(item.duration)}</Text>
        </View>
      ) : (
        <View style={[styles.messageTextFlex, styles.messageTextWrapper]}>
          <Text style={styles.messageText}>{messageText}</Text>
          {showRetryStatus ? (
            <Text style={styles.retryStatusText}>Re-establishing secure session…</Text>
          ) : null}
          {decryptionFailed ? (
            <View style={styles.decryptionBadge}>
              <Icon name="lock-open" size={12} color="#b3261e" style={styles.decryptionIcon} />
              <Text style={styles.decryptionBadgeText}>Decryption failed</Text>
            </View>
          ) : null}
        </View>
      )}
      {showClock ? (
        <View style={styles.messageStatusRow}>
          {item.time ? (
            <Text
              style={[
                styles.messageTime,
                styles.inlineTime,
                styles.statusTimeInRow,
                item.sender === 'me' ? styles.myTime : styles.theirTime,
                item.pending ? styles.pendingTime : null,
                item.failed ? styles.failedTime : null,
                { color: statusColor },
              ]}
            >
              {item.time}
            </Text>
          ) : null}
          <Icon
            name="schedule"
            size={12}
            color={statusColor}
            style={styles.statusIcon}
          />
        </View>
      ) : (
        <Text
          style={[
            styles.messageTime,
            styles.inlineTime,
            item.sender === 'me' ? styles.myTime : styles.theirTime,
            item.pending ? styles.pendingTime : null,
            item.failed ? styles.failedTime : null,
            { color: statusColor },
          ]}
        >
          {item.time}
        </Text>
      )}
    </View>
  );
};

export default function ChatDetailScreen() {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [showListPicker, setShowListPicker] = useState(false);
  const [selectedListId, setSelectedListId] = useState(null);
  const flatListRef = useRef();
  const activeCallIdRef = useRef(null);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const roomId = params?.roomId ? Number(params.roomId) : null;
  const roomKey = params?.roomKey ? String(params.roomKey) : null;
  const chatTitle = params?.title ? String(params.title) : 'Chat';
  const peerId = params?.peerId ? Number(params.peerId) : null;
  console.log('[ChatDetailScreen] params', params);
  const phoneNumber = useMemo(() => {
    const rawPhone = params?.phone;
    if (Array.isArray(rawPhone)) return rawPhone[0];
    return rawPhone ? String(rawPhone) : '';
  }, [params])

  const {
    messages: sessionMessages,
    sendTextMessage,
    notifyTyping,
    markLatestRead,
    typingUsers,
    isLoading: isHistoryLoading,
    error: historyError,
    currentUserId,
    retryDecryptMessage
  } = useChatSession({ roomId, roomKey, peerId, title: chatTitle });

  const [sharedLists, setSharedLists] = useState([]);
  const [sharedListsLoading, setSharedListsLoading] = useState(false);
  const [sharedListError, setSharedListError] = useState(null);
  const [selectedListData, setSelectedListData] = useState(null);
  const [isSelectedListLoading, setIsSelectedListLoading] = useState(false);
  const [selectedListError, setSelectedListError] = useState(null);

  useEffect(() => () => {
    activeCallIdRef.current = null;
  }, []);

  const [localMessages, setLocalMessages] = useState([]);
  const [deletedMessageIds, setDeletedMessageIds] = useState([]);
  const messages = useMemo(
    () => [...sessionMessages, ...localMessages],
    [sessionMessages, localMessages],
  );
  const filteredMessages = useMemo(
    () => messages.filter(message => !deletedMessageIds.includes(message.id)),
    [messages, deletedMessageIds],
  );
  const subtitleText = typingUsers.length
    ? 'typing…'
    : 'Messages are end-to-end encrypted';
  const avatarUri = params?.image && String(params.image).trim() ? String(params.image) : null;
  const avatarSource = avatarUri ? { uri: avatarUri } : null;
  const isRoomReady = Boolean(roomId && (roomKey || roomId));

  const recordingRef = useRef(null);
  const previewSoundRef = useRef(null);
  const playbackSoundRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  

  const handleCallRoomEvent = useCallback(
    event => {
      if (!event || event.type !== 'call.invite') {
        return;
      }
      const eventRoomId =
        typeof event.roomId === 'number' ? event.roomId : Number(event.roomId ?? roomId);
      if (!roomId || Number.isNaN(eventRoomId) || eventRoomId !== roomId) {
        return;
      }
      const callId = typeof event.callId === 'number' ? event.callId : Number(event.callId);
      if (!callId || Number.isNaN(callId)) {
        return;
      }
      if (activeCallIdRef.current === callId) {
        return;
      }
      const fromId = typeof event.from === 'number' ? event.from : Number(event.from);
      const calleeIds = Array.isArray(event.callees)
        ? event.callees
            .map(value => (typeof value === 'number' ? value : Number(value)))
            .filter(value => !Number.isNaN(value))
        : [];
      const participants = [...calleeIds, fromId].filter(value => !Number.isNaN(value));
      if (currentUserId != null && !participants.includes(currentUserId)) {
        return;
      }
      activeCallIdRef.current = callId;
      const role = fromId === currentUserId ? 'caller' : 'callee';
      router.push({
        pathname: '/screens/CallScreen',
        params: {
          callId: String(callId),
          roomId: roomId ? String(roomId) : '',
          name: chatTitle,
          ...(avatarUri ? { image: avatarUri } : {}),
          role,
          peerId: peerId != null ? String(peerId) : undefined,
        },
      });
      setTimeout(() => {
        if (activeCallIdRef.current === callId) {
          activeCallIdRef.current = null;
        }
      }, 3000);
    },
    [roomId, currentUserId, router, chatTitle, avatarUri, peerId],
  );

  const handleQueueEvent = useCallback(
    event => {
      if (!event) {
        return;
      }
      if (event.type === 'call.busy') {
        activeCallIdRef.current = null;
        Alert.alert('Call unavailable', event.reason || 'Participants are busy at the moment.');
        return;
      }
      if (event.event === 'BUSY') {
        const eventRoomId =
          typeof event.roomId === 'number' ? event.roomId : Number(event.roomId ?? roomId);
        if (!roomId || Number.isNaN(eventRoomId) || eventRoomId !== roomId) {
          return;
        }
        activeCallIdRef.current = null;
        if (Array.isArray(event.users) && event.users.length) {
          Alert.alert('Call unavailable', 'Some participants are already in another call.');
        }
      }
    },
    [roomId],
  );

  const { sendInviteDefault: sendRoomCallInvite } = useCallSignalingHook({
    roomId: roomId ?? null,
    onRoomEvent: handleCallRoomEvent,
    onQueueEvent: handleQueueEvent,
  });
  
  const pickAndSendFile = async () => {
  try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (res.type === 'cancel') return;

      const file = {
        id: Date.now().toString(),
        text: `📄 ${res.name}`,
        uri: res.uri,
        name: res.name,
        mimeType: res.mimeType,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'me',
        isFile: true,
        pending: true,
      };

      setLocalMessages(prev => [...prev, file]);
    } catch (err) {
      console.warn('File picker error:', err);
    }
  };
  const openCamera = () => {
    setAttachMenuVisible(false);
    router.push('/screens/CameraScreen');
  };

  const hideOverlay = () => {
    setSelectedListId(null);
    setShowListPicker(false);
    setAttachMenuVisible(false);
  };

  const normalizeSubQuantities = useCallback(raw => {
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        return parsed
          .map(sub => ({
            quantity: sub?.quantity ?? sub?.qty ?? '',
            priceText: sub?.priceText ?? sub?.price ?? '',
          }))
          .filter(sub => sub.quantity || sub.priceText);
      }
    } catch (err) {
      console.warn('Failed to parse sub quantities', err);
    }

    return [];
  }, []);

  const normalizeItems = useCallback(items => {
    if (!Array.isArray(items)) return [];

    return items.map(item => {
      const subQuantities = normalizeSubQuantities(item?.subQuantities ?? item?.subQuantitiesJson);
      return {
        id: item?.id != null ? String(item.id) : undefined,
        itemName: item?.itemName ?? 'Item',
        quantity: item?.quantity ?? '',
        priceText: item?.priceText ?? '',
        subQuantities,
      };
    });
  }, [normalizeSubQuantities]);

  const buildTodoState = useCallback(items => (
    items.map(item => ({
      checked: false,
      expanded: false,
      count: 1,
      subChecked: (item.subQuantities ?? []).map(() => false),
    }))
  ), []);

  const fetchSharedLists = useCallback(async () => {
    console.log('[ChatDetailScreen] fetchSharedLists inputs', { currentUserId, phoneNumber });
    if (!currentUserId || !phoneNumber) {
      setSharedListError('Missing user information to load shared lists.');
      setSharedLists([]);
      return;
    }

    setSharedListsLoading(true);
    setSharedListError(null);
    try {
      console.log('[ChatDetailScreen] fetchSharedLists calling API', { currentUserId, phoneNumber });
      const { data } = await apiClient.get('/api/lists/shared', {
        headers: { 'X-User-Id': String(currentUserId) },
        params: { phoneNumber },
      });

      const normalizedLists = (Array.isArray(data) ? data : [])
        .map(list => ({
          id: list?.id != null ? String(list.id) : null,
          title: list?.title ?? 'Untitled List',
        }))
        .filter(list => list.id);

      setSharedLists(normalizedLists);
    } catch (err) {
      console.error('Failed to fetch shared lists', err);
      setSharedListError('Unable to load shared lists. Pull to retry.');
    } finally {
      setSharedListsLoading(false);
    }
  }, [currentUserId, phoneNumber]);

  const fetchSelectedList = useCallback(async listId => {
     console.log('[ChatDetailScreen] fetchSelectedList inputs', { listId, currentUserId, phoneNumber });
    if (!listId || !currentUserId || !phoneNumber) {
      setSelectedListError('Missing user information to load list details.');
      return;
    }

    setIsSelectedListLoading(true);
    setSelectedListError(null);
    try {
      console.log('[ChatDetailScreen] fetchSelectedList calling API', { listId, currentUserId, phoneNumber });
      const { data } = await apiClient.get(`/api/lists/${encodeURIComponent(listId)}/shared`, {
        headers: { 'X-User-Id': String(currentUserId) },
        params: { phoneNumber },
      });

      const normalizedItems = normalizeItems(data?.items ?? []);
      const normalizedList = {
        id: data?.id != null ? String(data.id) : String(listId),
        title: data?.title ?? 'Shared List',
        items: normalizedItems,
      };

      setSelectedListData(normalizedList);
      setTodoState(buildTodoState(normalizedItems));
    } catch (err) {
      console.error('Failed to fetch shared list', err);
      setSelectedListError('Unable to load this list right now.');
      setSelectedListData(null);
      setTodoState([]);
    } finally {
      setIsSelectedListLoading(false);
    }
  }, [buildTodoState, currentUserId, normalizeItems, phoneNumber]);

  const [todoState, setTodoState] = useState([]);

  useEffect(() => {
    if (showListPicker && !selectedListId && !sharedListsLoading) {
      fetchSharedLists();
    }
  }, [fetchSharedLists, selectedListId, sharedListsLoading, showListPicker]);

  useEffect(() => {
    if (!selectedListId) {
      setSelectedListData(null);
      setTodoState([]);
      return;
    }

    fetchSelectedList(selectedListId);
  }, [fetchSelectedList, selectedListId]);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    notifyTyping(Boolean(input.trim()));
    return () => {
      notifyTyping(false);
    };
  }, [input, notifyTyping]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }
    const last = messages[messages.length - 1];
    if (last?.sender === 'other') {
      markLatestRead();
    }
  }, [messages, markLatestRead]);

  const clearSelection = useCallback(() => {
    setSelectedMessages([]);
    setMoreMenuVisible(false);
  }, []);

  useEffect(() => {
    setLocalMessages([]);
    setDeletedMessageIds([]);
    clearSelection();
  }, [roomId, roomKey, clearSelection]);

  useEffect(() => {
    setSelectedMessages(prev => prev.filter(msg => messages.find(m => m.id === msg.id)));
  }, [messages]);

  useEffect(() => {
    if (!selectedMessages.length) {
      setMoreMenuVisible(false);
    }
  }, [selectedMessages.length]);

  const sendCurrentMessage = async () => {
    const txt = input.trim();
    if (!txt) return;
     try {
      await sendTextMessage(txt);
      setInput('');
    } catch (err) {
      console.warn('Send message error:', err);
    }
  };

  const handleReply = () => {
    if (selectedMessages.length !== 1) {
      Alert.alert('Select one message', 'Please select a single message to reply.');
      return;
    }
    const [selectedMessage] = selectedMessages;
    setInput(prev => {
      const prefix = selectedMessage.text || 'Audio message';
      return prev ? `${prev}\nReplying to: ${prefix}` : `Replying to: ${prefix}`;
    });
    clearSelection();
  };

  const handleDeleteSelected = () => {
    if (!selectedMessages.length) return;
    setDeletedMessageIds(prev => {
      const idSet = new Set(prev);
      selectedMessages.forEach(message => idSet.add(message.id));
      return Array.from(idSet);
    });
    clearSelection();
  };

  const handleCopySelected = async () => {
    const textMessages = selectedMessages.filter(m => m.text);
    if (!textMessages.length) {
      Alert.alert('Copy unavailable', 'Only text messages can be copied.');
      setMoreMenuVisible(false);
      return;
    }
    try {
      await Clipboard.setStringAsync(textMessages.map(m => m.text).join('\n'));
      Alert.alert('Copied', 'Message copied to clipboard.');
    } catch (err) {
      console.warn('Copy message error:', err);
    } finally {
      setMoreMenuVisible(false);
    }
  };

  const handleForwardSelected = () => {
    if (!selectedMessages.length) return;
    Alert.alert('Forward', 'Forward message action triggered.');
    clearSelection();
  };

  const handleInfo = () => {
    Alert.alert('Message info', 'Info option selected.');
    setMoreMenuVisible(false);
  };

  const handlePin = () => {
    Alert.alert('Pinned', 'Message pinned.');
    setMoreMenuVisible(false);
  };

  const handleTranslate = () => {
    Alert.alert('Translate', 'Translate option selected.');
    setMoreMenuVisible(false);
  };

  function parseQty(qtyStr) {
    const m = /^([\d.]+)\s*(kg|g)$/i.exec(qtyStr);
    if (!m) return null;
    return { value: parseFloat(m[1]), unit: m[2].toLowerCase() };
  }

  const bottomOffset = insets.bottom + MARGIN * 2;

  // toggles ...
  const toggleCheck = i => setTodoState(s => { const c=[...s]; c[i].checked=!c[i].checked; return c; });
  const toggleExpand = i => setTodoState(s => { const c=[...s]; c[i].expanded=!c[i].expanded; return c; });
  const inc = i => setTodoState(s => { const c=[...s]; c[i].count++; return c; });
  const dec = i => setTodoState(s => { const c=[...s]; if(c[i].count>1)c[i].count--; return c; });
  const toggleSubCheck = (i, si) =>
    setTodoState(s => {
      const c = [...s];
      c[i].subChecked = [...c[i].subChecked];
      c[i].subChecked[si] = !c[i].subChecked[si];
      return c;
    });

  const renderTodoItem = ({ item, index }) => {
    const subQuantities = item.subQuantities ?? [];
    const st = todoState[index] ?? {
      checked: false,
      expanded: false,
      count: 1,
      subChecked: subQuantities.map(() => false),
    };
    const unitPrice = parseInt((item.priceText ?? '').replace(/[^0-9]/g, ''), 10) || 0;
    const displayedPrice = st.checked && unitPrice ? `₹${unitPrice * st.count}` : (item.priceText ?? '');

    return (
      <View>
        <View style={styles.todoRow}>
          <View style={styles.todoLeft}>
            <TouchableOpacity onPress={() => toggleCheck(index)} style={{ marginRight: 8 }}>
              <Icon name={st.checked ? 'check-box' : 'check-box-outline-blank'} size={24} color="#1f6ea7" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleExpand(index)} style={{ marginRight: 8 }}>
              <Icon name={st.expanded ? 'arrow-drop-up' : 'arrow-drop-down'} size={28} color="#333" />
            </TouchableOpacity>
            <Text style={styles.todoTitle}>{item.itemName}</Text>
          </View>
          <View style={styles.todoRight}>
            <Text style={styles.todoQty}>× {item.quantity || ''}</Text>
            {st.checked && (
              <View style={styles.counter}>
                <TouchableOpacity onPress={() => dec(index)}>
                  <Text style={styles.counterBtn}>–</Text>
                </TouchableOpacity>
                <Text style={styles.counterLabel}>{st.count}</Text>
                <TouchableOpacity onPress={() => inc(index)}>
                  <Text style={styles.counterBtn1}>＋</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.todoPrice}>{displayedPrice}</Text>
          </View>
        </View>

        {st.expanded && (
          <View style={styles.subContainer}>
            {subQuantities.map((sub, si) => (
              <View key={si} style={styles.subRow}>
                <View style={styles.todoLeft}>
                  <View style={{ width: 40 }} />
                  <TouchableOpacity onPress={() => toggleSubCheck(index, si)} style={{ marginRight: 8 }}>
                    <Icon
                      name={st.subChecked?.[si] ? 'check-box' : 'check-box-outline-blank'}
                      size={20}
                      color="#1f6ea7"
                    />
                  </TouchableOpacity>
                  <Text style={styles.todoTitle}>{sub.quantity}</Text>
                </View>
                <View style={styles.todoRight}>
                  <Text style={styles.todoQty} />
                  <Text style={styles.todoPrice}>{sub.priceText}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const anyChecked = todoState.some(e => e.checked);

  const stopPreviewPlayback = async () => {
      if (!previewSoundRef.current) return;
      try {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.setPositionAsync(0);
    } catch (err) {
      console.warn('Preview stop error:', err);
    }
    setIsPreviewPlaying(false);
  };

  const clearRecording = async () => {
    await stopPreviewPlayback();
    if (previewSoundRef.current) {
      try {
        await previewSoundRef.current.unloadAsync();
      } catch (err) {
        console.warn('Preview unload error:', err);
      }
      previewSoundRef.current = null;
    }
    setRecordedUri(null);
    setRecordingDuration(0);
    setIsPreviewPlaying(false);
  };

  const stopMessagePlayback = async () => {
    if (!playbackSoundRef.current) return;
    try {
      await playbackSoundRef.current.stopAsync();
      await playbackSoundRef.current.unloadAsync();
    } catch (err) {
      console.warn('Playback stop error:', err);
    }
    playbackSoundRef.current = null;
    setPlayingMessageId(null);
  };

  const requestAudioPermission = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow microphone access to record audio.');
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermission();
    if (!hasPermission) return;

    try {
      await stopMessagePlayback();
      await clearRecording();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        status => {
          if (status?.durationMillis != null) {
            setRecordingDuration(status.durationMillis);
          }
        },
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.warn('Start recording error:', err);
      setIsRecording(false);
      recordingRef.current = null;
    }
  };

  const stopRecording = async shouldSave => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (shouldSave) {
        setRecordingDuration(status?.durationMillis ?? recordingDuration);
        setRecordedUri(recording.getURI());
      } else {
        setRecordingDuration(0);
        setRecordedUri(null);
      }
    } catch (err) {
      console.warn('Stop recording error:', err);
      setRecordedUri(null);
    }
  };

  const togglePreviewPlayback = async () => {
    if (!recordedUri) return;
    try {
      await stopMessagePlayback();
      if (isPreviewPlaying && previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.setPositionAsync(0);
        setIsPreviewPlaying(false);
        return;
      }

      if (!previewSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: recordedUri });
        previewSoundRef.current = sound;
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            setIsPreviewPlaying(false);
            sound.setPositionAsync(0).catch(() => {});
          }
        });
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await previewSoundRef.current.replayAsync();
      setIsPreviewPlaying(true);
    } catch (err) {
      console.warn('Preview playback error:', err);
      setIsPreviewPlaying(false);
    }
  };

  const sendAudioMessage = async () => {
    if (!recordedUri) return;
    const duration = recordingDuration;
    const uri = recordedUri;
    setLocalMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        audio: uri,
        duration,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'me',
        pending: true,
      },
    ]);
    await clearRecording();
  };

  const toggleMessagePlayback = async message => {
    if (!message.audio) return;

    try {
      if (playingMessageId === message.id && playbackSoundRef.current) {
        await stopMessagePlayback();
        return;
      }

      await stopMessagePlayback();
      await stopPreviewPlayback();
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync({ uri: message.audio });
      playbackSoundRef.current = sound;
      setPlayingMessageId(message.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) {
          stopMessagePlayback().catch(() => {});
        }
      });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      await sound.playAsync();
    } catch (err) {
      console.warn('Message playback error:', err);
      await stopMessagePlayback();
    }
  };

  const handlePrimaryAction = async () => {
    if (input.trim()) {
      sendCurrentMessage();
      return;
    }

    if (isRecording) {
      await stopRecording(true);
      return;
    }

    if (recordedUri) {
      await sendAudioMessage();
      return;
    }

    await startRecording();
  };

  const handleDiscardRecording = async () => {
    if (isRecording) {
      await stopRecording(false);
      await clearRecording();
    } else {
      await clearRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
      if (playbackSoundRef.current) {
        playbackSoundRef.current.unloadAsync().catch(() => {});
        playbackSoundRef.current = null;
      }
    };
  }, []);

  const onAttach = async key => {
    setAttachMenuVisible(false);
    setSelectedListId(null);

    switch (key) {
      case 'photos':
        return router.push('/screens/PhotoPickerScreen');
      case 'files':
        return pickAndSendFile();
      case 'location':
        return router.push('/screens/LocationPickerScreen');
      case 'music':
        return router.push('/screens/AudioPickerScreen');
      case 'contacts':
        return router.push('/screens/ContactPickerScreen');
      case 'camera':
        return openCamera();
    }
  };

  const topInset = Platform.OS === 'android' ? 0 : insets.top;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#1f6ea7" barStyle="light-content" />

      {/* Header */}
       {isRoomReady ? (
        <>
          {/* Header */}
          <View
            style={[
              styles.header,
              { paddingTop: topInset, minHeight: BAR_HEIGHT + topInset },
            ]}
          >
             <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/screens/MocScreen');
              }}
              style={styles.iconBtn}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
           {!selectedMessages.length ? (
              <>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="person" size={24} color="#7a7a7a" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.titleContainer}
                  onPress={() => {
                    const media = filteredMessages.filter(m => m.image).map(m => m.image);
                    router.push({
                      pathname: '/screens/ContactProfileScreen',
                      params: {
                        name: chatTitle,
                         ...(avatarUri ? { image: avatarUri } : {}),
                        phone: params?.phone ? String(params.phone) : '',
                        media: JSON.stringify(media),
                      },
                    });
                  }}
                >
                  <Text style={styles.headerTitle}>{chatTitle}</Text>
                  <Text style={styles.headerSubtitle}>{subtitleText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={styles.headerActions}>
             {selectedMessages.length? (
                <>
                <Text style={styles.selectionCount}>{selectedMessages.length}</Text>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleReply}>
                    <Icon name="reply" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleDeleteSelected}>
                    <Icon name="delete" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleCopySelected}>
                    <Icon name="content-copy" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={handleForwardSelected}>
                    <Icon
                      name="reply"
                      size={24}
                      color="#fff"
                      style={{ transform: [{ scaleX: -1 }] }} // flip horizontally
                    />
                  </TouchableOpacity>
                  <View style={styles.moreMenuWrapper}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => setMoreMenuVisible(v => !v)}
                    >
                      <Icon name="more-vert" size={24} color="#fff" />
                    </TouchableOpacity>
                    {moreMenuVisible ? (
                      <View style={styles.moreMenu}>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleInfo}>
                          <Text style={styles.moreMenuText}>Info</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleCopySelected}>
                          <Text style={styles.moreMenuText}>Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handlePin}>
                          <Text style={styles.moreMenuText}>Pin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.moreMenuItem} onPress={handleTranslate}>
                          <Text style={styles.moreMenuText}>Translate</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/screens/VideoCallScreen',
                        params: {
                          name: chatTitle,
                          image: avatarUri,
                        },
                      })
                    }
                  >
                  <Icon name="videocam" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={async () => {
                      if (!roomId || !peerId) {
                        Alert.alert('Call unavailable', 'This chat is not ready for calling yet.');
                        return;
                      }
                      if (activeCallIdRef.current && activeCallIdRef.current !== 'pending') {
                        return;
                      }
                      activeCallIdRef.current = 'pending';
                      try {
                        await sendRoomCallInvite([peerId]);
                      } catch (err) {
                        activeCallIdRef.current = null;
                        console.warn('Failed to start voice call', err);
                        Alert.alert('Call failed', 'Unable to start the call. Please try again.');
                      } finally {
                        setTimeout(() => {
                          if (activeCallIdRef.current === 'pending') {
                            activeCallIdRef.current = null;
                          }
                        }, 10000);        
                      }
                       }}
                  >
                    <Icon name="call" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn}>
                    <Icon name="more-vert" size={24} color="#fff" />
              </TouchableOpacity>
               </>
              )}
            </View>
          </View>

      {/* Chat messages */}
          {historyError ? (
            <View style={styles.historyErrorBanner}>
              <Text style={styles.historyErrorText}>{historyError}</Text>
            </View>
          ) : null}
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={i => i.id}
            contentContainerStyle={{
              padding: 12,
              paddingBottom: MESSAGE_BAR_HEIGHT + bottomOffset,
            }}
            ListEmptyComponent={
              isHistoryLoading ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator color="#1f6ea7" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedMessages.some(m => m.id === item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() => {
                    setSelectedMessages(prev => {
                      if (prev.some(m => m.id === item.id)) return prev;
                      return [...prev, item];
                    });
                    setMoreMenuVisible(false);
                  }}
                  onPress={() => {
                    if (selectedMessages.length) {
                      setSelectedMessages(prev => {
                        const exists = prev.some(m => m.id === item.id);
                        if (exists) {
                          return prev.filter(m => m.id !== item.id);
                        }
                        return [...prev, item];
                      });
                    }
                  }}
                  style={[styles.messageRow, isSelected ? styles.selectedRow : null]}
                >
                  <View
                    style={[
                      styles.bubble,
                      item.sender === 'me' ? styles.myBubble : styles.theirBubble,
                      item.failed ? styles.failedBubble : null,
                      isSelected ? styles.selectedBubble : null,
                    ]}
                  >
                  <MessageContent
                      item={item}
                      playingMessageId={playingMessageId}
                      onTogglePlayback={toggleMessagePlayback}
                      onRetryDecrypt={retryDecryptMessage}
                    />
                  </View>
                </TouchableOpacity>
              );
            }}
          />

      {/* Attach grid */}
      {attachMenuVisible && (
        <>
          <TouchableOpacity style={styles.attachOverlay} onPress={() => setAttachMenuVisible(false)} />
          <View style={[styles.attachGrid, { bottom: insets.bottom + MESSAGE_BAR_HEIGHT + MARGIN }]}>
            {[
              ['photos', 'photo'],
              ['files', 'insert-drive-file'],
              ['camera', 'camera-alt'],
              ['location', 'location-on'],
              ['music', 'music-note'],
              ['contacts', 'account-circle'],
            ].map(([key, icon]) => (
              <TouchableOpacity key={key} style={styles.attachItem} onPress={() => onAttach(key)}>
                <View style={styles.attachCircle}>
                  <Icon name={icon} size={24} color="#fff" />
                </View>
                <Text style={styles.attachLabel}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* List picker */}
      {showListPicker && !selectedListId && (
        <View style={[styles.listPickerContainer, { bottom: MESSAGE_BAR_HEIGHT + bottomOffset }]}>
          <View style={styles.arrowDown} />
          <View style={styles.listPicker}>
            {sharedListsLoading ? (
              <ActivityIndicator size="small" color="#1f6ea7" />
            ) : sharedListError ? (
              <Text style={styles.listText}>{sharedListError}</Text>
            ) : sharedLists.length ? (
              sharedLists.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={styles.listItem}
                  onPress={() => {
                    setSelectedListId(l.id);
                    setShowListPicker(false);
                  }}>
                  <View style={styles.listBullet} />
                  <Text style={styles.listText}>{l.title}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.listText}>No shared lists available.</Text>
            )}
          </View>
        </View>
      )}

      {/* To‑Do overlay */}
      {selectedListId === '1' && (
        <View style={[styles.todoOverlay, { bottom: MESSAGE_BAR_HEIGHT + bottomOffset }]}>
          <View style={styles.todoHeader}>
            <TouchableOpacity onPress={() => setSelectedListId(null)} style={{ padding: 8 }}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.todoHeaderTitle}>{selectedListData?.title ?? 'Shared List'}</Text>

            {isSelectedListLoading && <ActivityIndicator size="small" color="#1f6ea7" />}

            {anyChecked && selectedListData?.items?.length ? (
              <TouchableOpacity
                onPress={() => {
                  const previewItems = [];
                 const items = selectedListData?.items ?? [];

                  items.forEach((item, idx) => {
                    const st = todoState[idx];
                     if (!st?.checked && !(st?.subChecked ?? []).some(Boolean)) return;

                     const basePrice = parseInt((item.priceText ?? '').replace(/[^0-9]/g, ''), 10) || 0;
                    let total = 0;
                    if (st?.checked) total += basePrice * (st?.count ?? 1);
                    (item.subQuantities ?? []).forEach((sub, si) => {
                      if (st?.subChecked?.[si]) {
                        const subPrice = parseInt((sub.priceText ?? '').replace(/[^0-9]/g, ''), 10) || 0;
                        total += subPrice;
                      }
                    });

                    const unitTotals = {};
                    if (st?.checked) {
                      const base = parseQty(item.quantity ?? '');
                      if (base) unitTotals[base.unit] = (unitTotals[base.unit] || 0) + base.value * (st?.count ?? 1);
                    }
                    (item.subQuantities ?? []).forEach((sub, si) => {
                      if (st?.subChecked?.[si]) {
                        const pq = parseQty(sub.quantity ?? '');
                        if (pq) unitTotals[pq.unit] = (unitTotals[pq.unit] || 0) + pq.value;
                      }
                    });

                    const parts = [];
                    ['kg', 'g'].forEach(u => {
                      const v = unitTotals[u];
                      if (v) {
                        const str = Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, '');
                        parts.push(`${str}${u}`);
                      }
                    });
                    const qtyText = parts.join(' + ');

                    previewItems.push({ name: item.itemName, qty: qtyText, price: `₹${total}` });
                  });

                  router.push({ pathname: '/screens/SelectedPreview', params: { preview: JSON.stringify(previewItems) } });
                }}
                style={styles.previewBtn}
                >
                <Icon name="send" size={24} color="#1f6ea7" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.headerDivider} />
          {isSelectedListLoading ? (
            <ActivityIndicator style={{ padding: 16 }} size="small" color="#1f6ea7" />
          ) : selectedListError ? (
            <Text style={[styles.listText, { padding: 16 }]}>{selectedListError}</Text>
          ) : selectedListData ? (
            <FlatList
              data={selectedListData.items}
              keyExtractor={(item, i) => item.id ?? i.toString()}
              renderItem={renderTodoItem}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          ) : null}
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', default: undefined })}
        keyboardVerticalOffset={BAR_HEIGHT + insets.top}>
        <View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + MARGIN,
              marginBottom: insets.bottom,
            },
          ]}>
          <View style={styles.composerContainer}>
            {(isRecording || recordedUri) && (
              <View style={styles.audioPreview}>
                <TouchableOpacity
                  style={styles.previewPlayButton}
                  onPress={() => (isRecording ? null : togglePreviewPlayback())}
                  disabled={isRecording}
                >
                  <Icon
                    name={
                      isRecording
                        ? 'fiber-manual-record'
                        : isPreviewPlaying
                          ? 'pause'
                          : 'play-arrow'
                    }
                    size={20}
                    color={isRecording ? '#d32f2f' : '#1f6ea7'}
                  />
                </TouchableOpacity>
                <Text style={styles.previewDuration}>
                  {isRecording
                     ? `Recording… ${formatDurationText(recordingDuration)}`
                    : formatDurationText(recordingDuration)}
                </Text>
                <TouchableOpacity style={styles.previewClose} onPress={handleDiscardRecording}>
                  <Icon name="close" size={18} color="#333" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.messageBar}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setAttachMenuVisible(v => !v);
                  setShowListPicker(false);
                  setSelectedListId(null);
                }}>
                <Icon name="attach-file" size={24} color="#888" />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Message"
                placeholderTextColor="#888"
                value={input}
                onChangeText={setInput}
                onFocus={hideOverlay}
              />  

             <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setShowListPicker(v => !v);
                  setSelectedListId(null);
                  setAttachMenuVisible(false);
                }}>
                <Icon name="playlist-add-check-circle" size={28} color="#888" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  hideOverlay();
                  openCamera();
                }}>
                <Icon name="camera-alt" size={24} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={handlePrimaryAction} style={styles.micButton}>
            <Icon
              name={
                input.trim()
                  ? 'send'
                  : isRecording
                    ? 'stop'
                    : recordedUri
                      ? 'send'
                      : 'mic'
              }
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
       </>
      ) : (
        <View style={styles.missingRoomWrapper}>
          <Icon
            name="chat-bubble-outline"
            size={48}
            color="#1f6ea7"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.missingRoomTitle}>Chat is syncing…</Text>
          <Text style={styles.missingRoomSubtitle}>
            We&apos;re setting up this conversation. Please return to your chats and try again in a moment.
          </Text>
          <TouchableOpacity
            style={styles.missingRoomButton}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/screens/MocScreen');
            }}
          >
            <Text style={styles.missingRoomButtonText}>Back to chats</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#eef5fa' },

  missingRoomWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  missingRoomTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f6ea7',
    marginBottom: 8,
  },
  missingRoomSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
  },
  missingRoomButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1f6ea7',
  },
  missingRoomButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  historyErrorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fdecea',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  historyErrorText: {
    color: '#b3261e',
    textAlign: 'center',
    fontSize: 13,
  },
  historyLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  header: {
    minHeight: BAR_HEIGHT,
    backgroundColor: '#1f6ea7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconBtn: { padding: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 8,
    backgroundColor: '#e6e6e6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  selectionCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    alignSelf: 'center',
  },
  headerActions: { flexDirection: 'row' },
  moreMenuWrapper: { position: 'relative' },
  moreMenu: {
    position: 'absolute',
    top: BAR_HEIGHT,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    paddingVertical: 4,
    minWidth: 140,
    zIndex: 5,
  },
  moreMenuItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  moreMenuText: { color: '#333', fontSize: 14 },
  headerSubtitle: {
    color: '#d8e8f6',
    fontSize: 12,
    marginTop: 2,
  },
  messageRow: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  selectedRow: {
    backgroundColor: '#8cbbdd',
  },
  bubble: {
    maxWidth: '80%',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  myBubble: {
    backgroundColor: '#C8E6C9',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  theirBubble: {
    backgroundColor: '#ECEFF1',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  selectedBubble: {
    backgroundColor: '#8cbbdd',
    borderWidth: 1,
    borderColor: '#1f6ea7',
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageText: { fontSize: 16, lineHeight: 20 },
  messageTextWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  messageTextFlex: {
    flexShrink: 1,
  },
  decryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  decryptionIcon: {
    marginRight: 2,
  },
  decryptionBadgeText: {
    color: '#b3261e',
    fontSize: 12,
    fontWeight: '600',
  },
  retryStatusText: {
    color: '#1f6ea7',
    fontSize: 12,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inlineTime: {
    marginTop: 0,
    marginLeft: 6,
  },
  myTime: { color: '#555' },
  theirTime: { color: '#777' },
  pendingTime: {
    color: '#1f6ea7',
    fontStyle: 'italic',
  },
  failedTime: {
    color: '#b3261e',
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: '#b3261e',
  },

  messageStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  statusTimeInRow: {
    marginTop: 0,
    marginLeft: 0,
  },
  statusIcon: {
    marginLeft: 4,
  },

  listPickerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  listPicker: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 8,
    elevation: 3,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f6ea7',
    marginRight: 12,
  },
  listText: { fontSize: 16, color: '#333' },

  todoOverlay: {
    position: 'absolute',
    width: '85%',
    right: 0,
    height: '84%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 5,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todoHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewBtn: {
  padding: 8,
  marginRight: 8,
},

  headerDivider: {
    height: 1,
    backgroundColor: '#333',
    marginHorizontal: 12,
  },

  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  todoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
  },
  todoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.8,
    justifyContent: 'space-between',
  },
  todoQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    color: '#555',
  },
  counter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ddd',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterBtn: { fontSize: 18, width: 24, textAlign: 'right' },
  counterBtn1: { fontSize: 18, width: 24, textAlign: 'left' },
  counterLabel: { fontSize: 14, width: 24, textAlign: 'center' },
  todoPrice: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: '#333',
  },
  subContainer: {
    backgroundColor: '#f2f2f2',
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 6,
  },

  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 40,
    paddingVertical: 6,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGIN,
    paddingTop: MARGIN,
  },
  messageBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: MESSAGE_BAR_HEIGHT,
    borderRadius: MESSAGE_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
  },

  composerContainer: {
    flex: 1,
    marginRight: MARGIN,
  },

  iconButton: { padding: 6, marginHorizontal: 2 },
    textInput: { flex: 1, fontSize: 16, marginHorizontal: 6, paddingVertical: 0 },
  micButton: {
    marginLeft: MARGIN,
    backgroundColor: '#1f6ea7',
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1f6ea7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    backgroundColor: '#e7f3fb',
  },
  previewPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  previewDuration: {
    flex: 1,
    color: '#1f6ea7',
    fontWeight: '600',
  },
  previewClose: {
    padding: 4,
    marginLeft: 8,
  },

  audioMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  audioDurationText: {
    fontSize: 16,
    color: '#1f6ea7',
    fontWeight: '600',
  },

 attachOverlay:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor:'transparent'
  },
      attachGrid:{
    position:'absolute',
    left:16,
    right:16,
    backgroundColor:'#fff',
    borderRadius:8,
    paddingVertical:12,
    flexDirection:'row',
    flexWrap:'wrap',
    justifyContent:'flex-start',
    elevation:4
  },
  attachItem:{
    width:'33%',
    alignItems:'center',
    marginVertical:12,
  },


  attachCircle:{
    width:48,
    height:48,
    borderRadius:24,
    backgroundColor:'#1f6ea7',
    alignItems:'center',
    justifyContent:'center'
  },
  attachLabel:{
    marginTop:4,
    fontSize:12,
    textTransform:'capitalize',
    color:'#333'
  },
});
