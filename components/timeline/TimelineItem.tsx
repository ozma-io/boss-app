import { TouchableOpacity } from 'react-native';
import { TimelineEntry } from '@/types';
import { NoteEntry } from './NoteEntry';
import { SurveyEntry } from './SurveyEntry';
import { InteractionEntry } from './InteractionEntry';

interface TimelineItemProps {
  entry: TimelineEntry;
  onPress?: (entry: TimelineEntry) => void;
}

export function TimelineItem({ entry, onPress }: TimelineItemProps) {
  const handlePress = (): void => {
    if (onPress) {
      onPress(entry);
    }
  };

  const renderEntry = () => {
    switch (entry.type) {
      case 'note':
        return <NoteEntry entry={entry} />;
      case 'survey':
        return <SurveyEntry entry={entry} />;
      case 'interaction':
        return <InteractionEntry entry={entry} />;
      default:
        return <NoteEntry entry={entry as any} />;
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {renderEntry()}
      </TouchableOpacity>
    );
  }

  return renderEntry();
}

