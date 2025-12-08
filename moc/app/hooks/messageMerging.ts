export type InternalMessage = {
  messageId: string;
  roomId: number;
  senderId: number | null;
  type: string;
  body?: string | null;
  serverTs?: string | null;
  ciphertext?: string | null;
  iv?: string | null;
  aad?: string | null;
  keyRef?: string | null;
  pending?: boolean;
  error?: boolean;
  readByPeer?: boolean;
  decryptionFailed?: boolean;
  e2ee?: boolean;
  debugBody?: string | null;
};

export const mergeIncomingMessage = (
  prev: InternalMessage[],
  incoming: InternalMessage,
): InternalMessage[] => {
  const idx = prev.findIndex(m => m.messageId === incoming.messageId);
  if (idx >= 0) {
    const next = [...prev];
    const existing = next[idx];
    next[idx] = {
      ...existing,
      ...incoming,
      body: incoming.body !== undefined ? incoming.body : existing.body,
      serverTs: incoming.serverTs ?? existing.serverTs,
      ciphertext: incoming.ciphertext ?? existing.ciphertext,
      aad: incoming.aad ?? existing.aad,
      iv: incoming.iv ?? existing.iv,
      keyRef: incoming.keyRef ?? existing.keyRef,
      readByPeer: incoming.readByPeer ?? existing.readByPeer,
      debugBody: incoming.debugBody ?? existing.debugBody,
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
};