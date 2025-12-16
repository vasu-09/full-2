import apiClient from './apiClient';

export const fetchMessageHistory = async (roomKey: string) => {
  const { data } = await apiClient.get(`/api/messages/${roomKey}/history`);
  return Array.isArray(data) ? data : [];
};

export const deleteMessageForMe = async (messageId: string | number) => {
  await apiClient.delete(`/api/messages/${messageId}/delete-for-me`);
};

export const deleteMessageForEveryone = async (messageId: string | number) => {
  await apiClient.delete(`/api/messages/${messageId}/delete-for-everyone`);
};

export const restoreMessageForMe = async (messageId: string | number) => {
  await apiClient.put(`/api/messages/${messageId}/delete-for-me`);
};

export const restoreMessageForEveryone = async (messageId: string | number) => {
  await apiClient.put(`/api/messages/${messageId}/delete-for-everyone`);
};

export const fetchPendingMessages = async (since?: string) => {
  const params = since ? { params: { since } } : undefined;
  const { data } = await apiClient.get('/api/messages/pending', params);
  return Array.isArray(data) ? data : [];
};