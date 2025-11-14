import { StyleSheet, Text, View } from 'react-native';

interface ChatBadgeProps {
  count: number;
  testID?: string;
}

/**
 * iOS-style notification badge
 * 
 * Displays a small red circle with white text showing unread count.
 * Automatically hides when count is 0.
 * Positioned absolutely to overlay in top-right corner of parent.
 */
export function ChatBadge({ count, testID = 'chat-badge' }: ChatBadgeProps) {
  if (count === 0) {
    return null;
  }

  // Format count: show 99+ for numbers >= 100
  const displayCount = count >= 100 ? '99+' : count.toString();

  return (
    <View style={styles.badge} testID={testID}>
      <Text style={styles.badgeText} testID={`${testID}-text`}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -15,
    right: -15,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30', // iOS red
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#F5F1E8', // Match background color for border effect
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope-Regular',
  },
});

