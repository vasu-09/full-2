import React from 'react';
import renderer, { ReactTestRendererJSON } from 'react-test-renderer';
import ChatDetailScreen from '../ChatDetailScreen';

const mockSendTextMessage = jest.fn();

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

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

jest.mock('../hooks/useCallSignaling', () => ({
  __esModule: true,
  default: () => ({ sendInviteDefault: jest.fn() }),
}));

jest.mock('../hooks/useChatSession', () => ({
  useChatSession: jest.fn(() => ({
    messages: [
      {
        id: 'm1',
        messageId: 'm1',
        roomId: 1,
        senderId: 99,
        sender: 'me' as const,
        text: 'Hello world',
        time: '10:00',
        raw: {},
      },
    ],
    sendTextMessage: mockSendTextMessage,
    notifyTyping: jest.fn(),
    markLatestRead: jest.fn(),
    typingUsers: [],
    isLoading: false,
    error: null,
    currentUserId: 99,
  })),
}));

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

describe('ChatDetailScreen', () => {
  it('renders plaintext messages instead of encryption placeholder', () => {
    let tree: ReactTestRendererJSON | ReactTestRendererJSON[] | null = null;
    renderer.act(() => {
      tree = renderer.create(<ChatDetailScreen />).toJSON();
    });

    const findText = (node: any, text: string): boolean => {
      if (node == null) {
        return false;
      }
      if (typeof node === 'string') {
        return node.includes(text);
      }
      if (Array.isArray(node)) {
        return node.some(child => findText(child, text));
      }
      if (typeof node === 'object') {
        const children = (node as ReactTestRendererJSON).children;
        return Array.isArray(children) && children.some(child => findText(child, text));
      }
      return false;
    };

    expect(findText(tree, 'Hello world')).toBe(true);
  });
});