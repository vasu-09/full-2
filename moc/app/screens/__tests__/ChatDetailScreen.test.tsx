import { render } from '@testing-library/react-native';
import React from 'react';
import { MessageContent } from '../ChatDetailScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({
    roomId: '1',
    roomKey: 'abc',
    title: 'Test Chat',
    peerId: '2',
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock('expo-audio', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn(),
    Recording: { createAsync: jest.fn(), OptionsPresets: { HIGH_QUALITY: {} } },
    Sound: {
      createAsync: jest.fn(async () => ({
        sound: {
          replayAsync: jest.fn(),
          setOnPlaybackStatusUpdate: jest.fn(),
        },
      })),
    },
  },
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('../../hooks/useCallSignaling', () => ({
  __esModule: true,
  default: () => ({ sendInviteDefault: jest.fn() }),
}));
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('../../hooks/useChatSession', () => ({
  useChatSession: jest.fn(() => ({
    messages: [],
    sendTextMessage: jest.fn(),
    notifyTyping: jest.fn(),
    markLatestRead: jest.fn(),
    typingUsers: [],
    isLoading: false,
    error: null,
    currentUserId: 99,
  })),
}));

describe('MessageContent', () => {
  it('renders sent message text with timestamp', () => {
    const message = {
      id: 'm1',
      messageId: 'm1',
      roomId: 1,
      senderId: 99,
      sender: 'me' as const,
      text: 'Hello world',
      time: '10:00',
      pending: false,
      failed: false,
    };

    const { getByText } = render(
      <MessageContent
        item={message}
        playingMessageId={null}
        onTogglePlayback={jest.fn()}
      />,
    );

    expect(getByText('Hello world')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
  });
});
