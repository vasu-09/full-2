import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChatRegistry } from '../context/ChatContext';
import { getStoredUserId } from '../services/authStorage';
import {
  ChatMessageDto,
  fetchRoomMessages,
  markRoomRead,
} from '../services/roomsService';
import stompClient, { StompFrame } from '../services/stompClient';

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
      .catch(() => setCurrentUserId(null));
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
      setRawMessages(ordered.map(toInternalMessage));
      const last = ordered[ordered.length - 1];
      if (last) {
        latestMessageIdRef.current = last.messageId;
        updateRoomActivity(roomKey ?? String(roomId), {
          messageId: last.messageId,
          text: last.body,
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
  }, [roomId, roomKey, updateRoomActivity, resetUnread]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
      const event: InternalMessage = {
        messageId: payload.messageId,
        roomId: payload.roomId,
        senderId: payload.senderId ?? null,
        type: payload.type ?? MESSAGE_TYPE_TEXT,
        body: payload.body,
        serverTs: payload.serverTs ?? new Date().toISOString(),
        pending: false,
        error: false,
      };
      mergeMessage(event);
      latestMessageIdRef.current = event.messageId;
      updateRoomActivity(roomKey, {
        messageId: event.messageId,
        text: event.body,
        at: event.serverTs ?? new Date().toISOString(),
        senderId: event.senderId ?? null,
      });
      if (event.senderId != null && currentUserId != null && event.senderId !== currentUserId) {
        incrementUnread(roomKey);
        const ackId = Number(payload.messageId);
        if (!Number.isNaN(ackId)) {
          stompClient
            .publish('/app/ack', { messageId: ackId })
            .catch(err => console.warn('Failed to acknowledge message delivery', err));
        }
      }
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
        await stompClient.publish(`/app/rooms/${roomKey}/send`, {
          messageId,
          type: MESSAGE_TYPE_TEXT,
          body,
          e2ee: false,
        });
      } catch (err) {
        console.warn('Failed to send message', err);
        mergeMessage({
          ...optimistic,
          pending: false,
          error: true,
        });
      }
    },
    [roomId, roomKey, currentUserId, mergeMessage, updateRoomActivity, resetUnread],
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