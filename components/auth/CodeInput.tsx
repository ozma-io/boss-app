import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface CodeInputProps {
  onCodeComplete: (code: string) => void;
}

export function CodeInput({ onCodeComplete }: CodeInputProps): React.JSX.Element {
  const [code, setCode] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleChangeText = (text: string, index: number): void => {
    if (text.length > 1) {
      text = text.charAt(text.length - 1);
    }

    if (!/^\d*$/.test(text)) {
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((digit: string) => digit !== '')) {
      onCodeComplete(newCode.join(''));
    }
  };

  const handleKeyPress = (event: { nativeEvent: { key: string } }, index: number): void => {
    if (event.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container} testID="code-input-container">
      {code.map((digit: string, index: number) => (
        <TextInput
          key={index}
          ref={(ref: TextInput | null) => {
            inputRefs.current[index] = ref;
          }}
          style={styles.input}
          value={digit}
          onChangeText={(text: string) => handleChangeText(text, index)}
          onKeyPress={(event: { nativeEvent: { key: string } }) => handleKeyPress(event, index)}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={index === 0}
          selectTextOnFocus
          testID={`code-input-${index}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 32,
  },
  input: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: '#fff',
  },
});

