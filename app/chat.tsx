import { SendArrowIcon } from '@/components/icons/SendArrowIcon';
import { TypingIndicator } from '@/components/TypingIndicator';
import { db } from '@/constants/firebase.config';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { extractTextFromContent, generateAIResponse, getOrCreateThread, loadOlderMessages, markChatAsRead, sendMessage, subscribeToMessages } from '@/services/chat.service';
import { logger } from '@/services/logger.service';
import { ChatMessage, ChatThread } from '@/types';
import { showToast } from '@/utils/toast';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Only import on native platforms
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sessionId } = useSession();
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [inputHeight, setInputHeight] = useState(40);
  
  // Pagination state
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [paginationBatchSize, setPaginationBatchSize] = useState(50);
  
  // Typing indicator timeout management
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unified function to reset unread count when chat is visible
  const resetUnreadCountIfVisible = useCallback(() => {
    if (user && threadId) {
      markChatAsRead(user.id, threadId).catch((error) => {
        logger.error('Failed to mark chat as read', { feature: 'ChatScreen', error });
      });
      
      // Clear app icon badge
      if (Platform.OS !== 'web' && Notifications) {
        Notifications.setBadgeCountAsync(0).catch((error: Error) => {
          logger.error('Failed to clear badge count', { feature: 'ChatScreen', error });
        });
      }
    }
  }, [user, threadId]);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('chat_screen_viewed');
      
      // Mark chat as read when user opens the screen
      resetUnreadCountIfVisible();
    }, [resetUnreadCountIfVisible])
  );

  // Reset unread count when app comes to foreground (handles scenario where chat is already open)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // When app comes to foreground and chat screen is mounted, reset counter
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        resetUnreadCountIfVisible();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, resetUnreadCountIfVisible]);

  // Initialize thread on mount
  useEffect(() => {
    if (!user) {
      return;
    }

    const initThread = async (): Promise<void> => {
      try {
        const id = await getOrCreateThread(user.id);
        setThreadId(id);
      } catch (error) {
        logger.error('Failed to initialize chat thread', { feature: 'ChatScreen', error });
      }
    };

    initThread();
  }, [user]);

  // Subscribe to messages when thread is ready
  useEffect(() => {
    if (!user || !threadId) {
      return;
    }

    const unsubscribe = subscribeToMessages(user.id, threadId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      
      // Mark messages as read when receiving updates (handles messages arriving while screen is visible)
      markChatAsRead(user.id, threadId).catch((error) => {
        logger.error('Failed to mark chat as read on message update', { feature: 'ChatScreen', error });
      });
      
      // On first load, set pagination state
      if (newMessages.length > 0) {
        // Messages are in DESC order (newest first)
        const oldestMessage = newMessages[newMessages.length - 1];
        setOldestTimestamp(oldestMessage.timestamp);
        
        // If we got fewer messages than the limit, there are no more older messages
        setHasMoreMessages(newMessages.length >= 20);
      }
    }, 20);

    return unsubscribe;
  }, [user, threadId]);

  // Subscribe to thread typing indicator
  useEffect(() => {
    if (!user || !threadId) {
      return;
    }

    const threadRef = doc(db, 'users', user.id, 'chatThreads', threadId);
    const unsubscribe = onSnapshot(threadRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const threadData = docSnapshot.data() as ChatThread;
        const assistantTyping = threadData.assistantIsTyping || false;
        
        // Clear timeout if Cloud Function disabled typing
        if (!assistantTyping && typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        
        setIsTyping(assistantTyping);
      }
    });

    return () => {
      unsubscribe();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user, threadId]);

  // Handler for loading older messages (pagination)
  const handleLoadOlder = async (): Promise<void> => {
    if (!user || !threadId || !oldestTimestamp || isLoadingOlder || !hasMoreMessages) {
      return;
    }

    setIsLoadingOlder(true);
    
    try {
      const result = await loadOlderMessages(user.id, threadId, oldestTimestamp, paginationBatchSize);
      
      if (result.messages.length > 0) {
        // Prepend older messages to existing messages (both in DESC order)
        setMessages((prev) => [...prev, ...result.messages]);
        
        // Update oldest timestamp for next pagination
        const newOldest = result.messages[result.messages.length - 1];
        setOldestTimestamp(newOldest.timestamp);
        
        // Increase batch size for next load (50 -> 100 -> 100...)
        if (paginationBatchSize === 50) {
          setPaginationBatchSize(100);
        }
      }
      
      setHasMoreMessages(result.hasMore);
    } catch (error) {
      logger.error('Failed to load older messages', { feature: 'ChatScreen', error });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleContentSizeChange = (event: any): void => {
    const contentHeight = event.nativeEvent.contentSize.height;
    const minHeight = 40;
    const maxHeight = 220;
    const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
    setInputHeight(newHeight);
  };

  const handleTextChange = (text: string): void => {
    setInputText(text);
    
    // Reset to min height if text is empty
    if (!text.trim()) {
      setInputHeight(40);
    }
  };

  const handleCopyMessage = async (text: string): Promise<void> => {
    try {
      await Clipboard.setStringAsync(text);
      showToast('Message copied', 1500);
      trackAmplitudeEvent('chat_message_copied', { textLength: text.length });
    } catch (error) {
      logger.error('Failed to copy message', { feature: 'ChatScreen', error });
    }
  };

  const handleSend = async (): Promise<void> => {
    if (!inputText.trim() || !user || !threadId) {
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');
    setInputHeight(40);

    try {
      // Send user message to Firestore
      const messageId = await sendMessage(user.id, threadId, textToSend);
      trackAmplitudeEvent('chat_message_sent', { textLength: textToSend.length });

      // Immediately show typing indicator for better UX
      setIsTyping(true);

      // Set fallback timeout (60 seconds) in case Cloud Function fails
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        typingTimeoutRef.current = null;
        logger.warn('Typing indicator timeout reached', { feature: 'ChatScreen', threadId });
      }, 60000);

      // Trigger AI response generation
      // The typing indicator will be managed by the Cloud Function
      generateAIResponse(user.id, threadId, messageId, sessionId).catch((error) => {
        logger.error('Failed to generate AI response', { feature: 'ChatScreen', error });
        // Don't show error to user, just log it
        // The typing indicator will be reset by the Cloud Function
      });
    } catch (error) {
      logger.error('Failed to send message', { feature: 'ChatScreen', error });
      // Reset typing indicator on error
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      // Restore input text on error
      setInputText(textToSend);
    }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user';
    const text = extractTextFromContent(message.content);
    
    return (
      <View
        key={`${message.timestamp}-${index}`}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer,
        ]}
        testID={`message-${index}`}
      >
        <Pressable
          onLongPress={() => handleCopyMessage(text)}
          style={[
            styles.messageBubble,
            isUser ? styles.userMessageBubble : styles.aiMessageBubble,
          ]}
          testID={`message-bubble-${index}`}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.aiMessageText,
            ]}
            testID={`message-text-${index}`}
          >
            {text}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent]} testID="chat-container">
        <Text style={styles.loadingText}>Please sign in to use chat</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="chat-container">
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#000" testID="loading-indicator" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted={true}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          renderItem={({ item, index }) => renderMessage(item, messages.length - 1 - index)}
          onEndReached={handleLoadOlder}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.messagesContent}
          testID="messages-list"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <>
              {isLoadingOlder && (
                <View style={styles.loaderContainer} testID="older-messages-loader">
                  <ActivityIndicator size="small" color="#666" />
                </View>
              )}
            </>
          }
          ListHeaderComponent={
            <>
              {isTyping && (
                <View style={styles.typingIndicatorContainer} testID="typing-indicator">
                  <View style={styles.typingIndicatorBubble}>
                    <TypingIndicator />
                  </View>
                </View>
              )}
            </>
          }
        />
      )}

      <KeyboardStickyView offset={{ closed: insets.bottom, opened: 0 }}>
        <View style={styles.inputContainer} testID="input-container">
          <TextInput
            style={[styles.input, { height: inputHeight }]}
            placeholder="Message"
            placeholderTextColor="rgba(0, 0, 0, 0.4)"
            value={inputText}
            onChangeText={handleTextChange}
            onContentSizeChange={handleContentSizeChange}
            testID="message-input"
            editable={!loading}
            multiline={true}
          />
          {inputText.trim() ? (
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSend} 
              testID="send-button"
              disabled={loading}
            >
              <SendArrowIcon size={20} color="#FFFFFF" testID="send-icon" />
            </TouchableOpacity>
          ) : null}
          {/* TODO: Implement voice input (microphone button hidden for MVP) */}
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F1E8',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Manrope-Regular',
  },
  messagesContent: {
    padding: 16,
  },
  loaderContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  userMessageBubble: {
    backgroundColor: '#B8E986',
  },
  aiMessageBubble: {
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Manrope-Regular',
  },
  userMessageText: {
    color: '#000',
  },
  aiMessageText: {
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F1E8',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
    fontFamily: 'Manrope-Regular',
    textAlignVertical: 'top',
  },
  micButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicatorContainer: {
    marginBottom: 12,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  typingIndicatorBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
});

