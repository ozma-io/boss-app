import { TimelineEntry } from '@/types';

export interface TimelineGroup {
  title: string;
  entries: TimelineEntry[];
}

export function groupTimelineEntries(entries: TimelineEntry[]): TimelineGroup[] {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = getEndOfWeek(now);

  const thisWeek: TimelineEntry[] = [];
  const previous: TimelineEntry[] = [];

  entries.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    
    if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
      thisWeek.push(entry);
    } else {
      previous.push(entry);
    }
  });

  const groups: TimelineGroup[] = [];

  if (thisWeek.length > 0) {
    groups.push({
      title: 'This week',
      entries: thisWeek,
    });
  }

  if (previous.length > 0) {
    groups.push({
      title: 'Previous',
      entries: previous,
    });
  }

  return groups;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatTimelineDate(timestamp: string): string {
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).replace(' ', '');
  
  return `${formattedDate} at ${formattedTime}`;
}

