import apiClient from './apiClient';

export interface ChatRoomResponse {
  id: number;
  roomId: string;
  name?: string | null;
  imageUrl?: string | null;
}

export interface ChatMessageDto {
  roomId: number;
  messageId: string;
  senderId: number;
  type: string;
  serverTs: string;
  body?: string;
  e2ee?: boolean;
  e2eeVer?: number;
  algo?: string;
  aad?: string;
  iv?: string;
  ciphertext?: string;
  keyRef?: string;
}

type HistoryParams = {
  beforeTs?: string | Date;
  beforeId?: string | number;
  limit?: number;
};

export const createDirectRoom = async (
  participantId: number,
): Promise<ChatRoomResponse> => {
  const { data } = await apiClient.post<ChatRoomResponse>('/api/rooms/direct', {
    participantId,
  });

  return data;
};

export const fetchRoomMessages = async (
  roomId: number,
  params: HistoryParams = {},
): Promise<ChatMessageDto[]> => {
  const query = { ...params };
  if (query.beforeTs instanceof Date) {
    query.beforeTs = query.beforeTs.toISOString();
  }

  const { data } = await apiClient.get<ChatMessageDto[]>(
    `/api/rooms/${roomId}/messages`,
    { params: query },
  );

  return Array.isArray(data) ? data : [];
};

export const markRoomRead = async (
  roomId: number,
  messageId: string,
): Promise<void> => {
  await apiClient.put(`/api/rooms/${roomId}/read`, undefined, {
    params: { messageId },
  });
};