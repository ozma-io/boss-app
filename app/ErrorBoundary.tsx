import { AppColors } from '@/constants/Colors';
import { logger } from '@/services/logger.service';
import { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Custom Error Boundary Component
 * 
 * Catches all React render errors and sends them to Sentry via logger.
 * Provides a user-friendly UI with retry functionality.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps): React.JSX.Element {
  // Log error to Sentry when component mounts or error changes
  useEffect(() => {
    if (error) {
      logger.error('React ErrorBoundary caught an error', {
        error: error instanceof Error ? error : new Error(String(error)),
        feature: 'ErrorBoundary',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, [error]);

  const handleRetry = async (): Promise<void> => {
    try {
      await retry();
    } catch (retryError) {
      logger.error('Failed to retry after error', {
        error: retryError instanceof Error ? retryError : new Error(String(retryError)),
        feature: 'ErrorBoundary',
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <View style={styles.container} testID="error-boundary-container">
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        testID="error-boundary-scroll"
      >
        <View style={styles.content}>
          <Text style={styles.icon} testID="error-boundary-icon">
            ⚠️
          </Text>
          
          <Text style={styles.title} testID="error-boundary-title">
            Something went wrong
          </Text>
          
          <Text style={styles.message} testID="error-boundary-message">
            {error instanceof Error ? error.message : String(error)}
          </Text>
          
          {__DEV__ && error instanceof Error && error.stack && (
            <View style={styles.stackContainer} testID="error-boundary-stack-container">
              <Text style={styles.stackTitle}>Error Stack (Development Only):</Text>
              <Text style={styles.stackTrace} testID="error-boundary-stack">
                {error.stack}
              </Text>
            </View>
          )}
          
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={handleRetry}
            testID="error-boundary-retry-button"
          >
            <Text style={styles.retryButtonText} testID="error-boundary-retry-text">
              Try Again
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Manrope-Bold',
    color: '#161616',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: AppColors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  stackContainer: {
    width: '100%',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  stackTitle: {
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
    color: '#161616',
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: '#161616',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonPressed: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
});

