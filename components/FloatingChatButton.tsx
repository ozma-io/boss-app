import { ChatIcon } from '@/components/icons/ChatIcon';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

interface FloatingChatButtonProps {
  style?: ViewStyle;
  testID?: string;
}

export function FloatingChatButton({ style, testID = 'chat-button' }: FloatingChatButtonProps) {
  const handleOpenChat = (): void => {
    router.push('/chat');
  };

  return (
    <TouchableOpacity
      style={[styles.chatButton, style]}
      onPress={handleOpenChat}
      activeOpacity={0.8}
      testID={testID}
    >
      <ChatIcon size={28} color="white" testID="chat-icon" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chatButton: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8E986',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
});

