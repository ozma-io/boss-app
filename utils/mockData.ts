import { ChatMessage } from '@/types';

// Mock chat messages
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    type: 'ai',
    text: 'Want to publicly support a teammate?\nThat builds your team-player image',
    timestamp: '2025-11-07T09:30:00Z',
  },
  {
    id: 'msg-2',
    type: 'user',
    text: 'Hmm, that\'s a good idea.\n\nAny suggestions on what to say?',
    timestamp: '2025-11-07T09:31:00Z',
  },
  {
    id: 'msg-3',
    type: 'ai',
    text: 'Sure! Here are a few quick examples:\n\n• "Big thanks to @Mia for jumping in on the client issue today — super fast and helpful!"\n\n• "Shout-out to the design team for polishing the demo slides — made a huge difference."\n\n• "Couldn\'t have wrapped this sprint without @Alex\'s help on the API fix."',
    timestamp: '2025-11-07T09:32:00Z',
  },
  {
    id: 'msg-4',
    type: 'user',
    text: 'Nice! I\'ll post the first one in Slack now.',
    timestamp: '2025-11-07T09:33:00Z',
  },
  {
    id: 'msg-5',
    type: 'ai',
    text: 'Awesome 🙌 — small moments like that build visibility and strengthen your relationships. Want me to remind you to do this again next week?',
    timestamp: '2025-11-07T09:34:00Z',
  },
  {
    id: 'msg-6',
    type: 'user',
    text: 'Yeah, let\'s do that.\n\nI will wait',
    timestamp: '2025-11-07T09:35:00Z',
  },
  {
    id: 'msg-7',
    type: 'ai',
    text: 'I\'ll check in next Friday! 💪',
    timestamp: '2025-11-07T09:36:00Z',
  },
];


