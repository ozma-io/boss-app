import { TimelineEntry } from '@/types';

export interface TimelineGroup {
  title: string;
  entries: TimelineEntry[];
}

export function groupTimelineEntries(entries: TimelineEntry[]): TimelineGroup[] {
  const now = new Date();
  const startOfToday = getStartOfDay(now);
  const startOfYesterday = getStartOfDay(addDays(now, -1));
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = getEndOfWeek(now);
  const startOfLastWeek = getStartOfWeek(addDays(now, -7));
  const endOfLastWeek = getEndOfWeek(addDays(now, -7));
  const startOfMonth = getStartOfMonth(now);
  const startOfLastMonth = getStartOfMonth(addMonths(now, -1));
  const endOfLastMonth = getEndOfMonth(addMonths(now, -1));

  const today: TimelineEntry[] = [];
  const yesterday: TimelineEntry[] = [];
  const thisWeek: TimelineEntry[] = [];
  const lastWeek: TimelineEntry[] = [];
  const thisMonth: TimelineEntry[] = [];
  const lastMonth: TimelineEntry[] = [];
  const previous: TimelineEntry[] = [];

  entries.forEach((entry) => {
    const entryDate = new Date(entry.timestamp);
    
    if (entryDate >= startOfToday) {
      today.push(entry);
    } else if (entryDate >= startOfYesterday && entryDate < startOfToday) {
      yesterday.push(entry);
    } else if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
      thisWeek.push(entry);
    } else if (entryDate >= startOfLastWeek && entryDate <= endOfLastWeek) {
      lastWeek.push(entry);
    } else if (entryDate >= startOfMonth) {
      thisMonth.push(entry);
    } else if (entryDate >= startOfLastMonth && entryDate <= endOfLastMonth) {
      lastMonth.push(entry);
    } else {
      previous.push(entry);
    }
  });

  const groups: TimelineGroup[] = [];

  if (today.length > 0) {
    groups.push({ title: 'Today', entries: today });
  }

  if (yesterday.length > 0) {
    groups.push({ title: 'Yesterday', entries: yesterday });
  }

  if (thisWeek.length > 0) {
    groups.push({ title: 'This week', entries: thisWeek });
  }

  if (lastWeek.length > 0) {
    groups.push({ title: 'Last week', entries: lastWeek });
  }

  if (thisMonth.length > 0) {
    groups.push({ title: 'This month', entries: thisMonth });
  }

  if (lastMonth.length > 0) {
    groups.push({ title: 'Last month', entries: lastMonth });
  }

  if (previous.length > 0) {
    groups.push({ title: 'Previous', entries: previous });
  }

  return groups;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
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

