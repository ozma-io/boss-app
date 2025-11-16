import { ChatBadge } from '@/components/ChatBadge';
import { ChatIcon } from '@/components/icons/ChatIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { logger } from '@/services/logger.service';
import { shouldShowNotificationOnboarding } from '@/services/user.service';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';

interface FloatingChatButtonProps {
  style?: ViewStyle;
  testID?: string;
}

export function FloatingChatButton({ style, testID = 'chat-button' }: FloatingChatButtonProps) {
  const unreadCount = useUnreadCount();
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  
  const handleOpenChat = async (): Promise<void> => {
    if (!user || isChecking) {
      return;
    }

    try {
      setIsChecking(true);
      
      // Check if we need to show notification onboarding first
      const shouldShow = await shouldShowNotificationOnboarding(user.id);
      
      if (shouldShow) {
        // Navigate to notification onboarding, it will redirect to chat after
        router.push('/notification-onboarding?returnTo=chat');
      } else {
        // Go directly to chat
        router.push('/chat');
      }
    } catch (error) {
      // If check fails, still allow navigation to chat (fail-safe)
      logger.warn('Failed to check notification onboarding before opening chat', { feature: 'FloatingChatButton', error });
      router.push('/chat');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.chatButton, style]}
      onPress={handleOpenChat}
      activeOpacity={0.8}
      testID={testID}
      disabled={isChecking}
    >
      <View>
        <ChatIcon size={28} color="white" testID="chat-icon" />
        <ChatBadge count={unreadCount} testID="chat-button-badge" />
      </View>
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
  },
});

