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

const BAR_HEIGHT = 56;
const MESSAGE_BAR_HEIGHT = 48;
const MARGIN = 8;
const MIC_SIZE = 48;


const userLists = [
  { id: '1', name: 'Grocery List of Kirana' },
  { id: '2', name: 'Travel check list' },
];

const DUMMY_LIST = {
  title: 'Grocery List of Kirana',
  items: [
    {
      itemName: 'Sugar',
      quantity: '1kg',
      priceText: '₹50',
      subQuantities: [
        { quantity: '500g', priceText: '₹25' },
        { quantity: '250g', priceText: '₹15' },
        { quantity: '100g', priceText: '₹5' },
      ],
    },
    {
      itemName: 'Salt',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Red-wine vinegar',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Freedom Sunflower oil',
      quantity: '1kg',
      priceText: '₹150',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Turmeric powder',
      quantity: '250g',
      priceText: '₹50',
      subQuantities: [{ quantity: '50g', priceText: '₹10' }],
    },
    {
      itemName: 'Groundnuts',
      quantity: '1kg',
      priceText: '₹130',
      subQuantities: [{ quantity: '500g', priceText: '₹60' },
        { quantity: '250g', priceText: '₹30' }],
    },
    {
      itemName: 'Black gram',
      quantity: '1kg',
      priceText: '₹130',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Masoor dal',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Chana dal',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Wheat flour',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
    {
      itemName: 'Urad dal',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    },
     {
      itemName: 'Roasted Chana dal',
      quantity: '1kg',
      priceText: '₹30',
      subQuantities: [{ quantity: '250g', priceText: '₹10' }],
    }
  ],
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

  const {
    messages: sessionMessages,
    sendTextMessage,
    notifyTyping,
    markLatestRead,
    typingUsers,
    isLoading: isHistoryLoading,
    error: historyError,
    currentUserId,
  } = useChatSession({ roomId, roomKey, peerId, title: chatTitle });

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
  const avatarUri = params?.image
    ? String(params.image)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(chatTitle)}`;
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
          image: avatarUri,
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

  const [todoState, setTodoState] = useState(
    DUMMY_LIST.items.map(item => ({
      checked: false,
      expanded: false,
      count: 1,
      subChecked: item.subQuantities.map(() => false),
    })),
  );

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
    const st = todoState[index];
    const unitPrice = parseInt(item.priceText.replace(/[^0-9]/g, ''), 10) || 0;
    const displayedPrice = st.checked ? `₹${unitPrice * st.count}` : item.priceText;

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
            <Text style={styles.todoQty}>× {item.quantity}</Text>
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
            {item.subQuantities.map((sub, si) => (
              <View key={si} style={styles.subRow}>
                <View style={styles.todoLeft}>
                  <View style={{ width: 40 }} />
                  <TouchableOpacity onPress={() => toggleSubCheck(index, si)} style={{ marginRight: 8 }}>
                    <Icon
                      name={st.subChecked[si] ? 'check-box' : 'check-box-outline-blank'}
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

  const formatDuration = millis => {
    const totalSeconds = Math.max(0, Math.floor((millis || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                <TouchableOpacity
                  style={styles.titleContainer}
                  onPress={() => {
                    const media = filteredMessages.filter(m => m.image).map(m => m.image);
                    router.push({
                      pathname: '/screens/ContactProfileScreen',
                      params: {
                        name: chatTitle,
                        image: avatarUri,
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
              paddingBottom:
                BAR_HEIGHT + MESSAGE_BAR_HEIGHT + bottomOffset + 12 + insets.top,
            }}
            ListEmptyComponent={
              isHistoryLoading ? (
                <View style={styles.historyLoading}>
                  <ActivityIndicator color="#1f6ea7" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
               const statusColor = item.failed
                ? '#b3261e'
                : item.pending
                  ? '#1f6ea7'
                  : item.sender === 'me'
                    ? '#555'
                    : '#777';
              const showClock = item.pending || item.failed;
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
                    {item.audio ? (
                      <View style={styles.audioMessageRow}>
                        <TouchableOpacity
                          style={styles.audioPlayButton}
                          onPress={() => toggleMessagePlayback(item)}
                          disabled={item.pending || item.failed}
                        >
                          <Icon
                            name={playingMessageId === item.id ? 'pause' : 'play-arrow'}
                            size={28}
                            color="#1f6ea7"
                          />
                        </TouchableOpacity>
                        <Text style={styles.audioDurationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.messageText}>{item.text}</Text>
                    )}
                    {showClock ? (
                      <View style={styles.messageStatusRow}>
                        {item.time ? (
                          <Text
                            style={[
                              styles.messageTime,
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
            {userLists.map(l => (
              <TouchableOpacity
                key={l.id}
                style={styles.listItem}
                onPress={() => {
                  setSelectedListId(l.id);
                  setShowListPicker(false);
                }}>
                <View style={styles.listBullet} />
                <Text style={styles.listText}>{l.name}</Text>
              </TouchableOpacity>
            ))}
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
            <Text style={styles.todoHeaderTitle}>{DUMMY_LIST.title}</Text>

            {anyChecked && (
  <TouchableOpacity
    onPress={() => {
                  // build preview items with collapsed same-unit sums
                  const previewItems = [];
                 DUMMY_LIST.items.forEach((item, idx) => {
                    const st = todoState[idx];
                    if (!st.checked && !st.subChecked.some(b => b)) return;

                    // compute total price
                    const basePrice = parseInt(item.priceText.replace(/[^0-9]/g, ''), 10) || 0;
                    let total = 0;
                    if (st.checked) total += basePrice * st.count;
                    item.subQuantities.forEach((sub, si) => {
                      if (st.subChecked[si]) {
                        const subPrice = parseInt(sub.priceText.replace(/[^0-9]/g, ''), 10) || 0;
                        total += subPrice;
                      }
                    });

                    // bucket quantities by unit
                    const unitTotals = {};
                    if (st.checked) {
                      const base = parseQty(item.quantity);
                      if (base) unitTotals[base.unit] = (unitTotals[base.unit] || 0) + base.value * st.count;
                    }
                    item.subQuantities.forEach((sub, si) => {
                      if (st.subChecked[si]) {
                        const pq = parseQty(sub.quantity);
                        if (pq) unitTotals[pq.unit] = (unitTotals[pq.unit] || 0) + pq.value;
                      }
                    });

                    // format as "Xkg + Yg"
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
    <Icon name="send" size={24} color="#1f6ea7"/>
  </TouchableOpacity>
)}
          </View>
          <View style={styles.headerDivider} />
          <FlatList
            data={DUMMY_LIST.items}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderTodoItem}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
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
                    ? `Recording… ${formatDuration(recordingDuration)}`
                    : formatDuration(recordingDuration)}
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
  messageText: { fontSize: 16, lineHeight: 20 },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
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


