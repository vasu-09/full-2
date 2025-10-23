import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

  const upsertRoom = useCallback(
    (room: Partial<RoomSummary> & { id: number; roomKey: string }) => {
      setRooms(prev => {
        const existingIndex = prev.findIndex(r => r.roomKey === room.roomKey);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...room,
            unreadCount: room.unreadCount ?? next[existingIndex].unreadCount,
          };
          return sortRooms(next);
        }

        const summary: RoomSummary = {
          id: room.id,
          roomKey: room.roomKey,
          title: room.title ?? room.roomKey,
          avatar: room.avatar ?? null,
          peerId: room.peerId ?? null,
          lastMessage: room.lastMessage ?? null,
          unreadCount: room.unreadCount ?? 0,
        };
        return sortRooms([...prev, summary]);
      });
    },
    [],
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
      return sortRooms(next);
    });
  }, []);

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
      return next;
    });
  }, []);

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
      return next;
    });
  }, []);

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