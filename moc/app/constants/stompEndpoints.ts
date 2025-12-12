export const roomTopic = (roomKey: string | number) => `/topic/room/${roomKey}`;
export const roomTypingTopic = (roomId: string | number) => `/topic/room/${roomId}/typing`;
export const roomReadTopic = (roomId: string | number) => `/topic/room/${roomId}/reads`;

export const dmTypingQueue = '/user/queue/typing';
export const dmReceiptQueue = '/user/queue/receipts';
export const ackQueue = '/user/queue/ack';
export const inboxQueue = '/user/queue/inbox';

export const sendRoomMessage = (roomKey: string | number) => `/app/rooms/${roomKey}/send`;
export const sendRoomTyping = (roomId: string | number) => `/app/room/${roomId}/typing`;
export const sendRoomRead = (roomId: string | number) => `/app/room/${roomId}/read`;
export const sendDirectTyping = (userId: string | number) => `/app/dm/${userId}/typing`;
export const sendDirectRead = (userId: string | number) => `/app/dm/${userId}/read`;