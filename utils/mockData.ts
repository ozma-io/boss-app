import { Boss, TimelineEntry } from '@/types';

// Mock boss data with all attributes
export const mockBoss: Boss = {
  id: 'boss-1',
  name: 'Sarah',
  position: 'CTO',
  department: 'Engineering',
  startedAt: '2024-09-01',
  birthday: 'March 15',
  managementStyle: 'Collaborative and empowering',
  currentMood: 'Focused and optimistic',
  favoriteColor: 'Deep blue',
  communicationPreference: 'Clear and concise updates',
  meetingFrequency: 'Weekly 1-on-1s',
  workingHours: '9:00 - 18:00',
  keyInterests: ['AI/ML', 'Team growth', 'Product quality'],
};

// Mock timeline entries (sorted newest first)
export const mockTimelineEntries: TimelineEntry[] = [
  {
    id: 'entry-1',
    type: 'note',
    timestamp: '2025-10-19T14:30:00Z',
    title: 'Preparation for quarterly review',
    content: 'Boss mentioned upcoming quarterly review. Need to prepare metrics and achievements from Q3. Focus on: completed features, team collaboration improvements, and technical debt reduction. She specifically asked about the API performance optimization project and its impact on user experience.',
    tags: ['quarterly-review', 'performance', 'Q3'],
  },
  {
    id: 'entry-2',
    type: 'interaction',
    timestamp: '2025-10-18T10:00:00Z',
    interactionType: '1-on-1 meeting',
    mood: 'positive',
    notes: 'Discussed project roadmap for Q4. Boss seemed enthusiastic about new features, especially the AI integration module. She emphasized the importance of user testing early in the cycle. Also talked about potential promotion path and skills to develop.',
    duration: 45,
    participants: ['Sarah (Boss)', 'Me'],
    topics: ['Q4 Roadmap', 'AI Integration', 'Career Development', 'User Testing'],
  },
  {
    id: 'entry-3',
    type: 'survey',
    timestamp: '2025-10-17T16:00:00Z',
    surveyTitle: 'Weekly Check-in',
    responses: [
      { question: 'Trust level (1-5)', answer: 4 },
      { question: 'Support level (1-5)', answer: 5 },
      { question: 'Clarity of expectations (1-5)', answer: 4 },
    ],
    notes: 'Overall positive week. Great support on the incident response. Could use more clarity on priorities for next sprint.',
  },
  {
    id: 'entry-4',
    type: 'note',
    timestamp: '2025-10-16T09:15:00Z',
    title: 'Coffee chat observation',
    content: 'Ran into boss at coffee machine. Chatted about weekend plans - she mentioned going hiking with family. Good casual rapport building. She seemed relaxed and in good spirits.',
    tags: ['casual', 'rapport'],
  },
  {
    id: 'entry-5',
    type: 'interaction',
    timestamp: '2025-10-15T15:30:00Z',
    interactionType: 'Team meeting',
    mood: 'neutral',
    notes: 'Sprint planning. Boss emphasized importance of code quality over speed. Pushed back on timeline for feature X, which created some tension. However, appreciated her focus on doing things right.',
    duration: 60,
    participants: ['Sarah (Boss)', 'Engineering Team'],
    topics: ['Sprint Planning', 'Code Quality', 'Timeline Discussion'],
  },
  {
    id: 'entry-6',
    type: 'note',
    timestamp: '2025-10-14T11:00:00Z',
    title: 'Feedback received',
    content: 'Got positive feedback on recent pull request. Boss appreciated thorough testing approach and clear documentation. She mentioned this is exactly the standard she wants the team to follow.',
    tags: ['feedback', 'positive', 'code-review'],
  },
  {
    id: 'entry-7',
    type: 'survey',
    timestamp: '2025-10-10T17:00:00Z',
    surveyTitle: 'Weekly Check-in',
    responses: [
      { question: 'Trust level (1-5)', answer: 4 },
      { question: 'Support level (1-5)', answer: 4 },
      { question: 'Clarity of expectations (1-5)', answer: 5 },
    ],
    notes: 'Solid week. Good alignment on expectations and deliverables.',
  },
  {
    id: 'entry-8',
    type: 'interaction',
    timestamp: '2025-10-09T14:00:00Z',
    interactionType: 'Slack conversation',
    mood: 'positive',
    notes: 'Quick sync on urgent bug fix. Boss was understanding about timeline slip and offered help. Appreciated her support and flexibility during the crisis.',
    duration: 10,
    participants: ['Sarah (Boss)', 'Me'],
    topics: ['Bug Fix', 'Timeline'],
  },
];

