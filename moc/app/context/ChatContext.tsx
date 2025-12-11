import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getRecentConversationsFromDb,
  setConversationUnreadInDb,
  upsertConversationInDb,
} from '../services/database';

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
  updateRoomActivity: (
    roomKey: string,
    message: RoomLastMessage,
    seed?: Partial<RoomSummary> & { id?: number },
  ) => void;
  incrementUnread: (roomKey: string, seed?: Partial<RoomSummary> & { id?: number }) => void;
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

  const ensureRoom = useCallback(
    (existing: RoomSummary[] = [], roomKey: string, seed?: Partial<RoomSummary> & { id?: number }) => {
      const idx = existing.findIndex(r => r.roomKey === roomKey);
      if (idx >= 0) {
        return { list: existing, room: existing[idx], index: idx } as const;
      }

      if (seed?.id == null) {
        return { list: existing, room: null, index: -1 } as const;
      }

      const created: RoomSummary = {
        id: seed.id,
        roomKey,
        title: seed.title ?? roomKey,
        avatar: seed.avatar ?? null,
        peerId: seed.peerId ?? null,
        lastMessage: seed.lastMessage ?? null,
        unreadCount: seed.unreadCount ?? 0,
      };

      persistConversation(created);
      const next = sortRooms([...existing, created]);
      return { list: next, room: created, index: next.findIndex(r => r.roomKey === roomKey) } as const;
    },
    [persistConversation],
  );

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

  const updateRoomActivity = useCallback(
    (roomKey: string, message: RoomLastMessage, seed?: Partial<RoomSummary> & { id?: number }) => {
      setRooms(prev => {
        const { list, room, index } = ensureRoom(prev, roomKey, seed);
        if (!room) {
          return prev;
        }
        const next = [...list];
        const targetIndex = index >= 0 ? index : next.findIndex(r => r.roomKey === roomKey);
        const current = targetIndex >= 0 ? next[targetIndex] : room;
        next[targetIndex >= 0 ? targetIndex : next.length] = {
          ...current,
          lastMessage: message,
        };
        persistConversation(next[targetIndex >= 0 ? targetIndex : next.length - 1]);
        return sortRooms(next);
      });
    },
    [ensureRoom, persistConversation],
  );

 const incrementUnread = useCallback(
    (roomKey: string, seed?: Partial<RoomSummary> & { id?: number }) => {
      setRooms(prev => {
        const { list, room, index } = ensureRoom(prev, roomKey, seed);
        if (!room) {
          return prev;
        }
        const next = [...list];
        const targetIndex = index >= 0 ? index : next.findIndex(r => r.roomKey === roomKey);
        const current = targetIndex >= 0 ? next[targetIndex] : room;
        const updated = {
          ...current,
          unreadCount: (current.unreadCount ?? 0) + 1,
        };
        next[targetIndex >= 0 ? targetIndex : next.length] = updated;
        setConversationUnreadInDb(updated.roomKey, updated.unreadCount).catch(err =>
          console.warn('Failed to increment unread counter in DB', err),
        );
        persistConversation(updated);
        return next;
      });
    },
    [ensureRoom, persistConversation],
  );

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

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChatRegistry = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatRegistry must be used within a ChatProvider');
  }
  return ctx;
};