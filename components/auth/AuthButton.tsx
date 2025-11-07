import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AuthButtonType = 'email' | 'google' | 'apple';

interface AuthButtonProps {
  type: AuthButtonType;
  onPress: () => void;
  disabled?: boolean;
}

const buttonConfig: Record<AuthButtonType, { icon: keyof typeof Ionicons.glyphMap; label: string; style: 'primary' | 'secondary' }> = {
  email: { icon: 'mail-outline', label: 'Sign in with Email', style: 'primary' },
  google: { icon: 'logo-google', label: 'Continue with Google', style: 'secondary' },
  apple: { icon: 'logo-apple', label: 'Continue with Apple', style: 'secondary' },
};

export function AuthButton({ type, onPress, disabled }: AuthButtonProps): React.JSX.Element {
  const config = buttonConfig[type];
  const isPrimary = config.style === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        <Ionicons
          name={config.icon}
          size={20}
          color={isPrimary ? '#fff' : '#000'}
          style={styles.icon}
        />
        <Text style={[styles.buttonText, isPrimary ? styles.primaryText : styles.secondaryText]}>
          {config.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#000',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: '#000',
  },
});

