import { SendArrowIcon } from '@/components/icons/SendArrowIcon';
import { TypingIndicator } from '@/components/TypingIndicator';
import { db } from '@/constants/firebase.config';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from '@/contexts/SessionContext';
import { trackAmplitudeEvent } from '@/services/amplitude.service';
import { extractTextFromContent, generateAIResponse, getOrCreateThread, sendMessage, subscribeToMessages } from '@/services/chat.service';
import { logger } from '@/services/logger.service';
import { ChatMessage, ChatThread } from '@/types';
import { useFocusEffect } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChatScreen() {
  const { user } = useAuth();
  const { sessionId } = useSession();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  useFocusEffect(
    useCallback(() => {
      trackAmplitudeEvent('chat_screen_viewed');
    }, [])
  );

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
    });

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
        setIsTyping(threadData.assistantIsTyping || false);
      }
    });

    return unsubscribe;
  }, [user, threadId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, loading]);

  const handleContentSizeChange = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleSend = async (): Promise<void> => {
    if (!inputText.trim() || !user || !threadId) {
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');

    try {
      // Send user message to Firestore
      const messageId = await sendMessage(user.id, threadId, textToSend);
      trackAmplitudeEvent('chat_message_sent', { textLength: textToSend.length });

      // Trigger AI response generation
      // The typing indicator will be managed by the Cloud Function
      generateAIResponse(user.id, threadId, messageId, sessionId).catch((error) => {
        logger.error('Failed to generate AI response', { feature: 'ChatScreen', error });
        // Don't show error to user, just log it
        // The typing indicator will be reset by the Cloud Function
      });
    } catch (error) {
      logger.error('Failed to send message', { feature: 'ChatScreen', error });
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
        <View
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
        </View>
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
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={handleContentSizeChange}
          testID="messages-scroll"
        >
          {loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#000" testID="loading-indicator" />
            </View>
          ) : (
            <>
              {messages.map((message, index) => renderMessage(message, index))}
              {isTyping && (
                <View style={styles.typingIndicatorContainer} testID="typing-indicator">
                  <View style={styles.typingIndicatorBubble}>
                    <TypingIndicator />
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.inputContainer} testID="input-container">
          <TextInput
            style={styles.input}
            placeholder="Lorem ipsum"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            testID="message-input"
            editable={!loading}
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
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
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
    color: '#333',
    fontFamily: 'Manrope-Regular',
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

