/**
 * Field Presets and Required Fields Configuration
 * 
 * This file contains:
 * 1. Lists of required fields for User and Boss documents
 * 2. Preset configurations for web funnel custom fields
 * 3. Timeline fact configurations
 * 
 * These presets are used when creating fields from the web funnel,
 * but are NOT enforced at the database level. They serve as:
 * - Documentation of available fields
 * - Configuration for field creation
 * - UI rendering hints
 */

/**
 * Required fields for User documents
 * These fields cannot be deleted and are enforced by Firestore security rules
 */
export const USER_REQUIRED_FIELDS = ['email', 'createdAt', 'name', 'goal', 'position'] as const;

/**
 * Required fields for Boss documents
 * These fields cannot be deleted and are enforced by Firestore security rules
 */
export const BOSS_REQUIRED_FIELDS = [
  'name',
  'position',
  'birthday',
  'managementStyle',
  'startedAt',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Field metadata type for presets
 */
export interface FieldPreset {
  label: string;
  type: 'text' | 'select' | 'date' | 'multiline' | 'multiselect';
  category: string;
  options?: string[];
  description?: string;
}

/**
 * User custom field presets from web funnel
 * 
 * These are used when creating custom fields from the onboarding funnel.
 * All fields are prefixed with `custom_` in the actual document.
 */
export const USER_FUNNEL_FIELD_PRESETS: Record<string, FieldPreset> = {
  custom_age: {
    label: 'Age',
    type: 'select',
    category: 'Demographics',
    options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
    description: 'User age range (Question 2)',
  },
  custom_whenStartedJob: {
    label: 'When Started Job',
    type: 'select',
    category: 'Career',
    options: [
      'Less than 2 weeks ago',
      '1-3 months ago',
      '3-6 months ago',
      'More than 6 months ago',
    ],
    description: 'When user started new job (Question 1)',
  },
  custom_goal: {
    label: 'Main Goal',
    type: 'text',
    category: 'Career',
    description: 'User main goal at new job (Question 3)',
  },
  custom_position: {
    label: 'Position',
    type: 'text',
    category: 'Career',
    description: 'Job position/title',
  },
  custom_department: {
    label: 'Department',
    type: 'text',
    category: 'Career',
    description: 'Department',
  },
  custom_skillsMatch: {
    label: 'Skills Match',
    type: 'select',
    category: 'Development',
    options: [
      'Feel a big gap',
      'Need to improve a lot',
      'Have gaps',
      'Mostly yes',
      'Yes, fully',
    ],
    description: 'Assessment of skills match for position (Question 28)',
  },
  custom_careerDiscussion: {
    label: 'Career Discussion',
    type: 'select',
    category: 'Development',
    options: [
      'Yes, in detail',
      'Briefly',
      'Planning to',
      "Don't know how to start",
      'Afraid to bring it up',
    ],
    description: 'Status of career growth discussion with boss (Question 30)',
  },
  custom_growthOpportunities: {
    label: 'Growth Opportunities',
    type: 'select',
    category: 'Development',
    options: [
      'Yes, clear path',
      'Seems like it',
      "Don't understand yet",
      'Rather no',
      "Don't see any",
    ],
    description: 'Visibility of growth opportunities (Question 31)',
  },
  custom_learningSupport: {
    label: 'Learning Support',
    type: 'select',
    category: 'Development',
    options: ['Not at all', 'Rather no', 'Neutral', 'Rather yes', 'Yes, definitely'],
    description: 'Company support for learning and development (Question 32)',
  },
};

/**
 * Boss custom field presets from web funnel
 * 
 * These are used when creating custom fields from the onboarding funnel.
 * All fields are prefixed with `custom_` in the actual document.
 */
export const BOSS_FUNNEL_FIELD_PRESETS: Record<string, FieldPreset> = {
  custom_age: {
    label: 'Boss Age',
    type: 'select',
    category: 'Demographics',
    options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
    description: 'Boss age range (Question 4)',
  },
  custom_oneOnOne: {
    label: 'One-on-One Meetings',
    type: 'select',
    category: 'Communication',
    options: [
      'Yes, every week',
      'Yes, every 2 weeks',
      'Yes, monthly',
      'Yes, but rarely',
      'No',
    ],
    description: 'Frequency of one-on-one meetings (Question 5)',
  },
  custom_availability: {
    label: 'Availability',
    type: 'select',
    category: 'Communication',
    options: [
      'Unavailable',
      'Often busy',
      'Sometimes available',
      'Usually available',
      'Always available',
    ],
    description: 'How easy to reach boss (Question 6)',
  },
  custom_communicationStyle: {
    label: 'Communication Style',
    type: 'select',
    category: 'Communication',
    options: [
      'Open and friendly',
      'Collaborative',
      'Reserved',
      'Directive',
      'Unpredictable',
      'Avoiding',
    ],
    description: 'Boss communication style (Question 7)',
  },
  custom_askingQuestions: {
    label: 'Asking Questions Comfort',
    type: 'select',
    category: 'Communication',
    options: [
      'Afraid to seem incompetent',
      'Try not to bother',
      'Depends on the topic',
      'Mostly yes',
      'Yes, always',
    ],
    description: 'Comfort level asking boss questions (Question 8)',
  },
  custom_sharingIdeas: {
    label: 'Sharing Ideas',
    type: 'select',
    category: 'Communication',
    options: ['Not at all', 'Rarely', 'Sometimes', 'Often', 'Yes, regularly'],
    description: 'Frequency of sharing ideas with boss (Question 12)',
  },
  custom_receivingFeedback: {
    label: 'Receiving Feedback Frequency',
    type: 'select',
    category: 'Feedback',
    options: [
      'Constantly',
      'Regularly',
      'Rarely',
      "Only when something's wrong",
      'Almost never',
    ],
    description: 'How often receiving feedback (Question 9)',
  },
  custom_feedbackClarity: {
    label: 'Feedback Clarity',
    type: 'select',
    category: 'Feedback',
    options: [
      'Always clear what to do',
      'Mostly clear',
      'Sometimes have to guess',
      'Often unclear',
      'Too vague',
    ],
    description: 'Clarity of feedback received (Question 10)',
  },
  custom_givingFeedback: {
    label: 'Giving Feedback Topics',
    type: 'multiselect',
    category: 'Feedback',
    options: [
      'Work processes',
      'Deadlines',
      'Communication style',
      'Unclear expectations',
      'In one-on-ones',
      'In writing',
      'Small things only',
      'When bothered',
      'Proactively',
      'Not yet, building courage',
    ],
    description: 'Types of feedback given to boss (Question 11, multi-select)',
  },
  custom_recognition: {
    label: 'Recognition',
    type: 'select',
    category: 'Feedback',
    options: [
      "Don't know yet",
      'Never',
      'Only for big achievements',
      'Rarely',
      'Sometimes',
      'Yes, regularly',
    ],
    description: 'Boss recognition pattern (Question 20)',
  },
  custom_mistakesHandling: {
    label: 'Mistakes Handling',
    type: 'select',
    category: 'Feedback',
    options: [
      'Helps fix and learn',
      'Discusses calmly',
      'Neutral',
      'Criticizes',
      "Haven't had situations yet",
    ],
    description: 'How boss reacts to mistakes (Question 21)',
  },
  custom_clearExpectations: {
    label: 'Clear Expectations',
    type: 'select',
    category: 'Expectations',
    options: [
      'Yes, absolutely clear',
      'Mostly yes',
      'Partially',
      'Probably not',
      'Not at all',
    ],
    description: 'Understanding of what is expected (Question 13)',
  },
  custom_successMetrics: {
    label: 'Success Metrics Knowledge',
    type: 'select',
    category: 'Expectations',
    options: [
      'Afraid to ask',
      "Don't know",
      'Guessing',
      'Roughly understand',
      'Yes, know exactly!',
    ],
    description: 'Knowledge of evaluation criteria (Question 14)',
  },
  custom_priorityClarity: {
    label: 'Priority Clarity',
    type: 'select',
    category: 'Expectations',
    options: [
      'Yes, always clear',
      'Usually yes',
      'Sometimes guessing',
      'Often unclear',
      'Constantly changing',
    ],
    description: 'Clarity on task priorities (Question 15)',
  },
  custom_decisionMaking: {
    label: 'Decision Making Understanding',
    type: 'select',
    category: 'Expectations',
    options: [
      'Yes, always clear',
      'Usually yes',
      'Sometimes guessing',
      'Often unclear',
      "Don't understand at all",
    ],
    description: 'Understanding of decision-making autonomy (Question 16)',
  },
  custom_feelingValued: {
    label: 'Feeling Valued',
    type: 'select',
    category: 'Appreciation',
    options: ['Not at all', 'Rather no', 'Not sure', 'Rather yes', 'Yes, definitely'],
    description: 'Feeling that contribution is valued (Question 22)',
  },
};

/**
 * Timeline fact field presets from web funnel
 * 
 * These are used when creating FactEntry documents in the timeline.
 * Each fact represents a state or assessment at a specific point in time.
 * All facts are prefixed with `custom_` in the factKey field.
 */
export const TIMELINE_FACT_PRESETS: Record<string, FieldPreset> = {
  custom_confidenceLevel: {
    label: 'Confidence Level',
    type: 'select',
    category: 'Emotions',
    options: [
      'Very confident',
      'Confident',
      'So-so',
      'Often doubt myself',
      'Imposter syndrome',
    ],
    description: 'Confidence level at work (Question 23)',
  },
  custom_mondayFeeling: {
    label: 'Monday Feeling',
    type: 'select',
    category: 'Emotions',
    options: ['Excited', 'Calm', 'Mild anxiety', 'Strong worry', 'Dread'],
    description: 'Feeling on Sunday evening before work week (Question 24)',
  },
  custom_imposterSyndrome: {
    label: 'Imposter Syndrome Situations',
    type: 'multiselect',
    category: 'Emotions',
    options: [
      'With new projects',
      'During presentations',
      'Before promotions',
      'In big meetings',
      'Managing others',
      'New responsibilities',
      'Technical challenges',
      'Client meetings',
      'Making decisions',
      'But do it anyway',
    ],
    description: 'Situations triggering imposter syndrome (Question 25, multi-select)',
  },
  custom_stressLevel: {
    label: 'Stress Level',
    type: 'select',
    category: 'Emotions',
    options: [
      'Very stressful',
      'Quite stressful',
      'Moderate',
      'A bit',
      'Not stressful at all',
    ],
    description: 'Current work stress level (Question 26)',
  },
  custom_workload: {
    label: 'Workload Management',
    type: 'select',
    category: 'Workload',
    options: [
      'Yes, comfortable',
      'Mostly yes',
      'Sometimes overloaded',
      "Often don't keep up",
      'Constantly overwhelmed',
    ],
    description: 'Ability to manage workload (Question 27)',
  },
  custom_workLifeBalance: {
    label: 'Work-Life Balance Challenges',
    type: 'multiselect',
    category: 'Workload',
    options: [
      'Work dominates',
      "Can't disconnect",
      'Miss personal events',
      'Work weekends',
      'Skip breaks',
      'Always on-call',
      'Unclear boundaries',
      'Feel guilty',
      'No time for hobbies',
      'Relationships suffer',
    ],
    description: 'Work-life balance challenges faced (Question 29, multi-select)',
  },
  custom_teamSupport: {
    label: 'Team Support',
    type: 'select',
    category: 'Team',
    options: ['Yes, very much', 'Rather yes', 'Not always', 'Rather no', 'Feel lonely'],
    description: 'Feeling of team support (Question 17)',
  },
  custom_onboardingQuality: {
    label: 'Onboarding Quality',
    type: 'select',
    category: 'Team',
    options: [
      'Excellent',
      'Pretty good',
      'Formal',
      'Chaotic',
      'Overwhelming',
      "Didn't happen",
    ],
    description: 'Quality of onboarding experience (Question 18)',
  },
  custom_gettingHelp: {
    label: 'Getting Help Strategies',
    type: 'multiselect',
    category: 'Team',
    options: [
      'Try myself first',
      'Ask for help',
      'Google it',
      'Ask AI',
      'Watch tutorials',
      'Break it down',
      'Avoid admitting',
      'Find examples',
      'Postpone it',
      'Experiment',
    ],
    description: 'Strategies when facing unfamiliar task (Question 19, multi-select)',
  },
  custom_biggestChallenge: {
    label: 'Biggest Challenges',
    type: 'multiselect',
    category: 'Challenges',
    options: [
      "Understanding boss's expectations",
      'Fitting into team',
      'Learning tech',
      'Proving my value',
      'Life balance',
      'New responsibilities',
      'Career direction',
      'Time management',
      'Workload',
      'Confidence issues',
    ],
    description: 'Hardest things right now (Question 33, multi-select)',
  },
  custom_mostUrgentNeed: {
    label: 'Most Urgent Need',
    type: 'select',
    category: 'Challenges',
    options: [
      'Understand how to communicate',
      'Learn to give feedback',
      'Overcome fear of mistakes',
      'Probation passing plan',
      'Other',
    ],
    description: 'What would help most right now (Question 34)',
  },
  custom_readyToAct: {
    label: 'Ready to Act',
    type: 'select',
    category: 'Motivation',
    options: ['Ready right now!', 'Ready to try', 'Not sure', 'Want to learn more'],
    description: 'Readiness to start improving situation (Question 35)',
  },
};

/**
 * Get all custom field keys for User
 */
export function getUserCustomFieldKeys(): string[] {
  return Object.keys(USER_FUNNEL_FIELD_PRESETS);
}

/**
 * Get all custom field keys for Boss
 */
export function getBossCustomFieldKeys(): string[] {
  return Object.keys(BOSS_FUNNEL_FIELD_PRESETS);
}

/**
 * Get all timeline fact keys
 */
export function getTimelineFactKeys(): string[] {
  return Object.keys(TIMELINE_FACT_PRESETS);
}

/**
 * Check if a field is required for User
 */
export function isUserFieldRequired(fieldKey: string): boolean {
  return USER_REQUIRED_FIELDS.includes(fieldKey as any);
}

/**
 * Check if a field is required for Boss
 */
export function isBossFieldRequired(fieldKey: string): boolean {
  return BOSS_REQUIRED_FIELDS.includes(fieldKey as any);
}

