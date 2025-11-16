import { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextStyle } from 'react-native';

interface InlineEditableHeadingProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
}

export function InlineEditableHeading({
  value,
  onSave,
  placeholder,
  testID,
  style,
}: InlineEditableHeadingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');

  const handleEdit = (): void => {
    setText(value);
    setIsEditing(true);
  };

  const handleBlur = async (): Promise<void> => {
    setIsEditing(false);
    if (text !== value) {
      await onSave(text);
    }
  };

  return (
    <Pressable 
      onPress={isEditing ? undefined : handleEdit}
      testID={`${testID}-pressable`}
    >
      {isEditing ? (
        <TextInput
          style={[styles.defaultText, style, styles.input, { outlineStyle: 'none' } as any]}
          value={text}
          onChangeText={setText}
          onBlur={handleBlur}
          autoFocus
          placeholder={placeholder}
          testID={`${testID}-input`}
        />
      ) : (
        <Text style={[styles.defaultText, style]} testID={`${testID}-text`}>{value}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  defaultText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'Manrope-Bold',
  },
  input: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    textAlign: 'center',
  },
});

