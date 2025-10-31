import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChatRegistry } from '../context/ChatContext';
import { getStoredUserId } from '../services/authStorage';
import {
  ChatMessageDto,
  fetchRoomMessages,
  markRoomRead,
} from '../services/roomsService';
import stompClient, { StompFrame } from '../services/stompClient';
import { getE2EEClient, E2EEClient, E2EEEnvelope } from '../services/e2ee';

type InternalMessage = {
  messageId: string;
  roomId: number;
  senderId: number | null;
  type: string;
  body?: string | null;
  serverTs?: string | null;
  pending?: boolean;
  error?: boolean;
  readByPeer?: boolean;
  decryptionFailed?: boolean;
  e2ee?: boolean;
};

export type DisplayMessage = {
  id: string;
  messageId: string;
  roomId: number;
  senderId: number | null;
  sender: 'me' | 'other';
  text?: string | null;
  time: string;
  serverTs?: string | null;
  pending?: boolean;
  failed?: boolean;
  raw: InternalMessage;
  readByPeer?: boolean;
};

type TypingUser = {
  userId: number;
  expiresAt: number;
};

const MESSAGE_TYPE_TEXT = 'TEXT';

const formatTime = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const toInternalMessage = (dto: ChatMessageDto): InternalMessage => ({
  messageId: dto.messageId,
  roomId: dto.roomId,
  senderId: dto.senderId,
  type: dto.type,
  body: dto.body,
  serverTs: dto.serverTs,
  pending: false,
  error: false,
  readByPeer: false,
  e2ee: dto.e2ee,
});

const generateMessageId = () => {
  if (typeof globalThis !== 'undefined' && (globalThis as any)?.crypto?.randomUUID) {
    return (globalThis as any).crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const parseFrameBody = (frame: StompFrame) => {
  try {
    return frame.body ? JSON.parse(frame.body) : null;
  } catch (err) {
    console.warn('Failed to parse STOMP frame body', err);
    return null;
  }
};

export const useChatSession = ({
  roomId,
  roomKey,
  peerId,
  title,
}: {
  roomId: number | null;
  roomKey: string | null;
  peerId?: number | null;
  title?: string | null;
}) => {
  const { upsertRoom, updateRoomActivity, incrementUnread, resetUnread } = useChatRegistry();
  const [rawMessages, setRawMessages] = useState<InternalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [e2eeClient, setE2eeClient] = useState<E2EEClient | null>(null);
  const [e2eeReady, setE2eeReady] = useState(false);
  const latestMessageIdRef = useRef<string | null>(null);
  const typingSentRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    getStoredUserId()
      .then(value => {
        if (value != null) {
          const parsed = Number(value);
          setCurrentUserId(Number.isNaN(parsed) ? null : parsed);
        }
      })
      .catch(() => setCurrentUserId(null))
      .finally(() => setUserLoaded(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getE2EEClient()
      .then(client => {
        if (!cancelled) {
          setE2eeClient(client);
        }
      })
      .catch(err => {
        console.warn('E2EE initialization failed', err);
        if (!cancelled) {
          setE2eeClient(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setE2eeReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId || !roomKey) {
      return;
    }
    upsertRoom({ id: roomId, roomKey, title: title ?? roomKey, peerId: peerId ?? null });
  }, [roomId, roomKey, title, peerId, upsertRoom]);

  const mergeMessage = useCallback((incoming: InternalMessage) => {
    setRawMessages(prev => {
      const idx = prev.findIndex(m => m.messageId === incoming.messageId);
      if (idx >= 0) {
        const next = [...prev];
       next[idx] = {
          ...next[idx],
          ...incoming,
          readByPeer:
            incoming.readByPeer !== undefined ? incoming.readByPeer : next[idx].readByPeer,
        };
        return next;
      }
      return [
        ...prev,
        {
          ...incoming,
          readByPeer: incoming.readByPeer ?? false,
        },
      ];
    });
  }, []);

  const loadHistory = useCallback(async () => {
    if (!roomId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRoomMessages(roomId, { limit: 50 });
      const ordered = data.slice().reverse();
      const client = e2eeClient;
      const processed = await Promise.all(
        ordered.map(async dto => {
          const base = toInternalMessage(dto);
          let text = dto.body ?? null;
          let failed = false;
          if (dto.e2ee && dto.ciphertext && dto.aad && dto.iv && dto.keyRef) {
            const envelope: E2EEEnvelope = {
              messageId: dto.messageId,
              aad: dto.aad,
              iv: dto.iv,
              ciphertext: dto.ciphertext,
              keyRef: dto.keyRef,
            };
            const fromSelf = currentUserId != null && dto.senderId === currentUserId;
            if (client) {
              try {
                text = await client.decryptEnvelope(envelope, Boolean(fromSelf));
              } catch (decryptErr) {
                console.warn('Failed to decrypt history message', decryptErr);
                text = 'Unable to decrypt message';
                failed = true;
              }
            } else {
              text = 'Encrypted message';
              failed = true;
            }
          }
          return { ...base, body: text, decryptionFailed: failed };
        }),
      );
      setRawMessages(processed);
      const last = ordered[ordered.length - 1];
      if (last) {
        latestMessageIdRef.current = last.messageId;
        updateRoomActivity(roomKey ?? String(roomId), {
          messageId: last.messageId,
          text: last.body ?? 'Encrypted message',
          at: last.serverTs ?? new Date().toISOString(),
          senderId: last.senderId,
        });
      }
      resetUnread(roomKey ?? String(roomId));
    } catch (err) {
      console.warn('Failed to load room history', err);
      setError('Unable to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, roomKey, updateRoomActivity, resetUnread, e2eeClient, currentUserId]);

  useEffect(() => {
    if (!userLoaded) {
      return;
    }
    if (peerId && !e2eeReady) {
      return;
    }
    loadHistory();
  }, [loadHistory, userLoaded, peerId, e2eeReady]);

  useEffect(() => {
    
    if (!roomId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sendPing = () =>
      stompClient
        .publish(`/app/room/${roomId}/ping`, {
          deviceId: 'mobile',
        })
        .catch(err => {
          console.warn('Failed to send presence ping', err);
        });

    stompClient
      .ensureConnected()
      .then(() => {
        if (cancelled) {
          return;
        }
        sendPing();
        timer = setInterval(sendPing, 15000);
      })
      .catch(err => {
        console.warn('Unable to establish STOMP connection for pings', err);
      });

    return () => {
      cancelled = true;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [roomId]);


  useEffect(() => {
    if (!roomId || !roomKey) {
      return;
    }

    let cancelled = false;
    stompClient
      .ensureConnected()
      .then(() => {
        if (cancelled) {
          return;
        }
        setIsConnected(true);
      })
      .catch(err => {
        if (!cancelled) {
          console.warn('Unable to connect to STOMP broker', err);
          setIsConnected(false);
        }
      });

    const messageSub = stompClient.subscribe(`/topic/room/${roomKey}`, frame => {
      const payload = parseFrameBody(frame);
      if (!payload) {
        return;
      }
      const base: InternalMessage = {
        messageId: payload.messageId,
        roomId: payload.roomId,
        senderId: payload.senderId ?? null,
        type: payload.type ?? MESSAGE_TYPE_TEXT,
        serverTs: payload.serverTs ?? new Date().toISOString(),
        pending: false,
        error: false,
        e2ee: Boolean(payload.e2ee),
      };
      const finalize = (text: string | null, failed = false) => {
        mergeMessage({
          ...base,
          body: text,
          decryptionFailed: failed,
        });
        latestMessageIdRef.current = base.messageId;
        updateRoomActivity(roomKey, {
          messageId: base.messageId,
          text: text ?? 'Encrypted message',
          at: base.serverTs ?? new Date().toISOString(),
          senderId: base.senderId ?? null,
        });
        if (base.senderId != null && currentUserId != null && base.senderId !== currentUserId) {
          incrementUnread(roomKey);
          const ackId = Number(payload.messageId);
          if (!Number.isNaN(ackId)) {
            stompClient
              .publish('/app/ack', { messageId: ackId })
              .catch(err => console.warn('Failed to acknowledge message delivery', err));
          }
        }
      };

      if (payload.e2ee) {
        const fromSelf = currentUserId != null && base.senderId === currentUserId;
        if (fromSelf) {
          mergeMessage({ ...base });
          return;
        }
        if (payload.ciphertext && payload.aad && payload.iv && payload.keyRef) {
          const envelope: E2EEEnvelope = {
            messageId: String(payload.messageId ?? ''),
            aad: payload.aad,
            iv: payload.iv,
            ciphertext: payload.ciphertext,
            keyRef: payload.keyRef,
          };
          if (e2eeClient) {
            e2eeClient
              .decryptEnvelope(envelope, false)
              .then(text => finalize(text))
              .catch(err => {
                console.warn('Failed to decrypt incoming message', err);
                finalize('Unable to decrypt message', true);
              });
          } else {
            finalize('Encrypted message', true);
          }
        } else {
          finalize('Encrypted message', true);
        }
        return;
      }

      finalize(payload.body ?? null);
    });

    const ackSub = stompClient.subscribe('/user/queue/ack', frame => {
      const payload = parseFrameBody(frame);
      if (!payload || payload.roomId !== roomKey) {
        return;
      }
      mergeMessage({
        messageId: payload.messageId,
        roomId: roomId,
        senderId: currentUserId,
        type: MESSAGE_TYPE_TEXT,
        serverTs: payload.serverTs,
        pending: false,
        error: false,
      });
    });

    const typingSub = stompClient.subscribe(`/topic/room/${roomId}/typing`, frame => {
      const payload = parseFrameBody(frame);
      if (!payload || typeof payload.userId !== 'number') {
        return;
      }
      if (currentUserId != null && payload.userId === currentUserId) {
        return;
      }
      const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).getTime() : Date.now() + 5000;
      setTyping(prev => {
        const filtered = prev.filter(t => t.userId !== payload.userId);
        if (payload.typing === false) {
          return filtered;
        }
        return [...filtered, { userId: payload.userId, expiresAt }];
      });
    });

    const readSub = stompClient.subscribe(`/topic/room/${roomId}/reads`, frame => {
      const payload = parseFrameBody(frame);
      if (!payload || payload.userId == null) {
        return;
      }
      if (currentUserId != null && payload.userId === currentUserId) {
        resetUnread(roomKey);
      }
    });

    const subs: (() => void)[] = [messageSub, ackSub, typingSub, readSub];

    if (peerId != null) {
      const dmTypingSub = stompClient.subscribe('/user/queue/typing', frame => {
        const payload = parseFrameBody(frame);
        if (!payload || payload.senderId == null) {
          return;
        }
        const sender = typeof payload.senderId === 'number' ? payload.senderId : Number(payload.senderId);
        if (sender !== peerId) {
          return;
        }
        const expiresAt = Date.now() + 5000;
        setTyping(prev => {
          const filtered = prev.filter(t => t.userId !== sender);
          return [...filtered, { userId: sender, expiresAt }];
        });
      });

      const dmReadSub = stompClient.subscribe('/user/queue/receipts', frame => {
        const payload = parseFrameBody(frame);
        if (!payload) {
          return;
        }
        const sender = typeof payload.senderId === 'number' ? payload.senderId : Number(payload.senderId);
        const payloadRoomId =
          typeof payload.roomId === 'number' ? payload.roomId : Number(payload.roomId ?? roomId);
        if (Number.isNaN(payloadRoomId) || sender !== peerId || payloadRoomId !== roomId) {
          return;
        }
        const messageKey = String(payload.messageId ?? '');
        if (!messageKey) {
          return;
        }
        setRawMessages(prev =>
          prev.map(msg =>
            msg.messageId === messageKey
              ? {
                  ...msg,
                  readByPeer: true,
                }
              : msg,
          ),
        );
      });

      subs.push(dmTypingSub, dmReadSub);
    }

    subscriptionsRef.current = subs;

    return () => {
      cancelled = true;
      setIsConnected(false);
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current = [];
    };
 }, [
    roomId,
    roomKey,
    mergeMessage,
    updateRoomActivity,
    incrementUnread,
    resetUnread,
    currentUserId,
    peerId,
    e2eeClient,
  ]);

  useEffect(() => {
    if (!typing.length) {
      return;
    }
    const now = Date.now();
    const next = typing.filter(entry => entry.expiresAt > now);
    if (next.length !== typing.length) {
      setTyping(next);
    }
    const timer = setTimeout(() => {
      setTyping(prev => prev.filter(entry => entry.expiresAt > Date.now()));
    }, 1500);
    return () => clearTimeout(timer);
  }, [typing]);

  const displayMessages: DisplayMessage[] = useMemo(() => {
    return rawMessages
      .slice()
      .sort((a, b) => {
        const aTime = a.serverTs ?? '';
        const bTime = b.serverTs ?? '';
        if (aTime === bTime) {
          return a.messageId.localeCompare(b.messageId);
        }
        return aTime.localeCompare(bTime);
      })
      .map(msg => {
        const sender: 'me' | 'other' =
          currentUserId != null && msg.senderId === currentUserId ? 'me' : 'other';
        return {
          id: msg.messageId,
          messageId: msg.messageId,
          roomId: msg.roomId,
          senderId: msg.senderId ?? null,
          sender,
          text: msg.body,
          time: formatTime(msg.serverTs),
          serverTs: msg.serverTs,
          pending: msg.pending,
          failed: msg.error,
          raw: msg,
          readByPeer: msg.readByPeer,
        };
      });
  }, [rawMessages, currentUserId]);

  const sendTypingUpdate = useCallback(
    (isTyping: boolean) => {
      if (!roomId) {
        return;
      }
      stompClient.publish(`/app/room/${roomId}/typing`, {
        typing: isTyping,
        deviceId: 'mobile',
      });
      if (peerId != null) {
        stompClient.publish(`/app/dm/${peerId}/typing`, {
          roomId,
          typing: isTyping,
        });
      }
    },
    [roomId, peerId],
  );

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!roomId) {
        return;
      }

      if (isTyping) {
        if (!typingSentRef.current) {
          typingSentRef.current = true;
          sendTypingUpdate(true);
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          typingSentRef.current = false;
          sendTypingUpdate(false);
        }, 3000);
      } else if (typingSentRef.current) {
        typingSentRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        sendTypingUpdate(false);
      }
    },
    [roomId, sendTypingUpdate],
  );

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!roomId || !roomKey || !text.trim()) {
        return;
      }
      const body = text.trim();
      const messageId = generateMessageId();
      const nowIso = new Date().toISOString();
      const optimistic: InternalMessage = {
        messageId,
        roomId,
        senderId: currentUserId,
        type: MESSAGE_TYPE_TEXT,
        body,
        serverTs: nowIso,
        pending: true,
        error: false,
        readByPeer: false,
        e2ee: Boolean(peerId && e2eeClient),
      };
      mergeMessage(optimistic);
      latestMessageIdRef.current = messageId;
      updateRoomActivity(roomKey, {
        messageId,
        text: body,
        at: nowIso,
        senderId: currentUserId ?? undefined,
      });
      resetUnread(roomKey);
      try {
        let payload: Record<string, unknown> | null = null;
        if (peerId && e2eeClient) {
          try {
            const encrypted = await e2eeClient.encryptForUser(peerId, messageId, body);
            if (encrypted) {
              payload = {
                messageId,
                type: MESSAGE_TYPE_TEXT,
                e2ee: true,
                e2eeVer: encrypted.envelope.e2eeVer,
                algo: encrypted.envelope.algo,
                aad: encrypted.envelope.aad,
                iv: encrypted.envelope.iv,
                ciphertext: encrypted.envelope.ciphertext,
                keyRef: encrypted.envelope.keyRef,
              };
            }
          } catch (encryptErr) {
            console.warn('Failed to encrypt message', encryptErr);
          }
        }
        if (!payload) {
          payload = {
            messageId,
            type: MESSAGE_TYPE_TEXT,
            body,
            e2ee: false,
          };
        }
        await stompClient.publish(`/app/rooms/${roomKey}/send`, payload);
      } catch (err) {
        console.warn('Failed to send message', err);
        mergeMessage({
          ...optimistic,
          pending: false,
          error: true,
        });
      }
    },
    [roomId, roomKey, currentUserId, mergeMessage, updateRoomActivity, resetUnread, peerId, e2eeClient],
  );

  const markLatestRead = useCallback(async () => {
    if (!roomId || !roomKey) {
      return;
    }
    const lastMessageId = latestMessageIdRef.current;
    if (!lastMessageId) {
      return;
    }
    try {
      await markRoomRead(roomId, lastMessageId);
      await stompClient.publish(`/app/room/${roomId}/read`, {
        lastReadMessageId: lastMessageId,
      });
      if (peerId != null) {
        await stompClient.publish(`/app/dm/${peerId}/read`, {
          roomId,
          messageId: lastMessageId,
        });
      }
      resetUnread(roomKey);
    } catch (err) {
      console.warn('Failed to mark messages as read', err);
    }
  }, [roomId, roomKey, resetUnread, peerId]);

  const typingUsers = useMemo(() => typing.map(entry => entry.userId), [typing]);

  return {
    messages: displayMessages,
    isLoading,
    isConnected,
    error,
    sendTextMessage,
    notifyTyping,
    markLatestRead,
    typingUsers,
    currentUserId,
  } as const;
};

export type ChatSessionHook = ReturnType<typeof useChatSession>;