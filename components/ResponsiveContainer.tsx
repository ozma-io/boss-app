import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  backgroundColor?: string;
}

export function ResponsiveContainer({ 
  children, 
  maxWidth = 600,
  backgroundColor = 'transparent',
}: ResponsiveContainerProps): React.JSX.Element {
  return (
    <View style={[styles.outerContainer, { backgroundColor }]}>
      <View style={[styles.innerContainer, { maxWidth }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
  },
});

