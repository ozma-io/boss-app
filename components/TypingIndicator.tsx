import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

export function TypingIndicator() {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <Text style={styles.typingIndicatorText} testID="typing-indicator-text">
      Typing{dots}
    </Text>
  );
}

const styles = StyleSheet.create({
  typingIndicatorText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#666',
    fontFamily: 'Manrope-Regular',
    fontStyle: 'italic',
    minWidth: 70,
  },
});

