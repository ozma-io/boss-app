import { TouchableOpacity } from 'react-native';
import { TimelineEntry } from '@/types';
import { NoteEntry } from './NoteEntry';
import { SurveyEntry } from './SurveyEntry';
import { InteractionEntry } from './InteractionEntry';

interface TimelineItemProps {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
  testID?: string;
}

export function TimelineItem({ entry, onPress, testID }: TimelineItemProps) {
  const handlePress = (): void => {
    if (onPress) {
      onPress(entry);
    }
  };

  const renderEntry = () => {
    switch (entry.type) {
      case 'note':
        return <NoteEntry entry={entry} testID={testID} />;
      case 'survey':
        return <SurveyEntry entry={entry} testID={testID} />;
      case 'interaction':
        return <InteractionEntry entry={entry} testID={testID} />;
      default:
        return <NoteEntry entry={entry as any} testID={testID} />;
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} testID={testID}>
        {renderEntry()}
      </TouchableOpacity>
    );
  }

  return renderEntry();
}

