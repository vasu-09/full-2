import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { roomTopic } from '../constants/stompEndpoints';
import { getStoredUserId } from '../services/authStorage';
import {
  getRecentConversationsFromDb,
  setConversationUnreadInDb,
  upsertConversationInDb,
} from '../services/database';
import { ChatMessageDto } from '../services/roomsService';
import stompClient from '../services/stompClient';

export type RoomLastMessage = {
  messageId: string;
  text?: string | null;
  at: string;
  senderId?: number | null;
};

export type RoomSummary = {
  id: number;
  roomKey: string;
  title: string;
  avatar?: string | null;
  peerId?: number | null;
  lastMessage?: RoomLastMessage | null;
  unreadCount: number;
};

type ChatContextValue = {
  rooms: RoomSummary[];
  upsertRoom: (room: Partial<RoomSummary> & { id: number; roomKey: string }) => void;
  updateRoomActivity: (roomKey: string, message: RoomLastMessage) => void;
  incrementUnread: (roomKey: string) => void;
  resetUnread: (roomKey: string) => void;
};

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

const sortRooms = (rooms: RoomSummary[]) => {
  return [...rooms].sort((a, b) => {
    const aTime = a.lastMessage?.at ?? '1970-01-01T00:00:00Z';
    const bTime = b.lastMessage?.at ?? '1970-01-01T00:00:00Z';
    return bTime.localeCompare(aTime);
  });
};

export const ChatProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const subscriptionsRef = useRef<Record<string, () => void>>({});

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
    let cancelled = false;

    getRecentConversationsFromDb()
      .then(results => {
        if (cancelled) {
          return;
        }
        const restored = results.map(room => ({
          id: room.id,
          roomKey: room.roomKey,
          title: room.title ?? room.roomKey,
          avatar: room.avatar ?? null,
          peerId: room.peerId ?? null,
          lastMessage: room.lastMessage
            ? {
                messageId: room.lastMessage.id,
                text: room.lastMessage.plaintext ?? room.lastMessage.ciphertext ?? undefined,
                at: room.lastMessage.createdAt ?? new Date().toISOString(),
                senderId: room.lastMessage.senderId ?? undefined,
              }
            : null,
          unreadCount: room.unreadCount ?? 0,
        }));
        setRooms(sortRooms(restored));
      })
      .catch(err => console.warn('Failed to hydrate chat registry from SQLite', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const persistConversation = useCallback((summary: RoomSummary) => {
    upsertConversationInDb({
      id: summary.id,
      roomKey: summary.roomKey,
      title: summary.title,
      avatar: summary.avatar,
      peerId: summary.peerId,
      unreadCount: summary.unreadCount,
      updatedAt: summary.lastMessage?.at,
    }).catch(err => console.warn('Failed to persist conversation', summary.id, err));
  }, []);

  const upsertRoom = useCallback(
    (room: Partial<RoomSummary> & { id: number; roomKey: string }) => {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.roomKey === room.roomKey);
        let nextSummary: RoomSummary;
        if (existingIndex >= 0) {
          const next = [...prev];
          nextSummary  = {
            ...next[existingIndex],
            ...room,
            unreadCount: room.unreadCount ?? next[existingIndex].unreadCount,
          };
          next[existingIndex] = nextSummary;
          persistConversation(nextSummary);
          return sortRooms(next);
        }

        nextSummary  = {
          id: room.id,
          roomKey: room.roomKey,
          title: room.title ?? room.roomKey,
          avatar: room.avatar ?? null,
          peerId: room.peerId ?? null,
          lastMessage: room.lastMessage ?? null,
          unreadCount: room.unreadCount ?? 0,
        };
        persistConversation(nextSummary);
        return sortRooms([...prev, nextSummary]);
      });
    },
    [persistConversation],
  );

  const updateRoomActivity = useCallback((roomKey: string, message: RoomLastMessage) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        lastMessage: message,
      };
      persistConversation(next[idx]);
      return sortRooms(next);
    });
  }, [persistConversation]);

  const incrementUnread = useCallback((roomKey: string) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        unreadCount: next[idx].unreadCount + 1,
      };
      setConversationUnreadInDb(next[idx].roomKey, next[idx].unreadCount).catch(err =>
        console.warn('Failed to increment unread counter in DB', err),
      );
      persistConversation(next[idx]);
      return next;
    });
  }, [persistConversation]);

  const resetUnread = useCallback((roomKey: string) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.roomKey === roomKey);
      if (idx === -1) {
        return prev;
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        unreadCount: 0,
      };
       setConversationUnreadInDb(next[idx].roomKey, 0).catch(err =>
        console.warn('Failed to reset unread counter in DB', err),
      );
      persistConversation(next[idx]);
      return next;
    });
  }, [persistConversation]);

  const value = useMemo(
    () => ({ rooms, upsertRoom, updateRoomActivity, incrementUnread, resetUnread }),
    [rooms, upsertRoom, updateRoomActivity, incrementUnread, resetUnread],
  );

  useEffect(() => {
  const existingSubs = subscriptionsRef.current;
  const activeKeys = new Set(rooms.map(room => room.roomKey));

  Object.entries(existingSubs).forEach(([key, unsubscribe]) => {
    if (!activeKeys.has(key)) {
      try { unsubscribe(); } catch {}
      delete existingSubs[key];
    }
  });

  let cancelled = false;

  // ✅ Always connect, even when rooms is empty
  stompClient
    .ensureConnected()
    .then(() => {
      // Only subscribe to room topics when we actually have rooms
      rooms.forEach(room => {
        const key = room.roomKey;
        if (!key || existingSubs[key]) return;

        const unsubscribe = stompClient.subscribe(roomTopic(key), frame => {
          if (cancelled) return;

          let payload: ChatMessageDto | null = null;
          try {
            payload = frame.body ? JSON.parse(frame.body) : null;
          } catch (err) {
            console.warn('Failed to parse inbound message frame', err);
            return;
          }
          if (!payload) return;

          const lastMessage = {
            messageId: payload.messageId,
            text: payload.body ?? payload.ciphertext ?? null,
            at: payload.serverTs ?? new Date().toISOString(),
            senderId: payload.senderId ?? null,
          };

          updateRoomActivity(key, lastMessage);

          if (payload.roomId != null && payload.roomId !== room.id) {
            upsertRoom({ ...room, id: payload.roomId, roomKey: key });
          }

          if (currentUserId == null || payload.senderId !== currentUserId) {
            incrementUnread(key);
          }
        });

        existingSubs[key] = unsubscribe;
      });
    })
    .catch(err => console.warn('Global chat listener failed to connect', err));

  return () => {
    cancelled = true;
  };
}, [rooms, incrementUnread, updateRoomActivity, upsertRoom, currentUserId]);

  useEffect(
    () => () => {
      const subs = subscriptionsRef.current;
      Object.values(subs).forEach(unsubscribe => {
        try {
          unsubscribe();
        } catch {
      
          // ignore
        }
      });
      subscriptionsRef.current = {};
    },
    [],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatRegistry = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatRegistry must be used within a ChatProvider');
  }
  return ctx;
};