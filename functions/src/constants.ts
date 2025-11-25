/**
 * Configuration Constants for Cloud Functions
 * 
 * Defines constants directly to avoid TypeScript compilation issues.
 */

// ============================================================================
// Facebook Configuration
// ============================================================================
// ⚠️ DUPLICATED in ../../constants/facebook.config.ts - keep both in sync!
export const FACEBOOK_PIXEL_ID = '1170898585142562';
export const FACEBOOK_API_VERSION = 'v24.0';
// ============================================================================
// End of duplicated section
// ============================================================================

// ============================================================================
// Chat Configuration
// ============================================================================

/**
 * Number of hours to include in chat message history
 * Only messages from the last N hours will be sent to OpenAI
 */
export const CHAT_MESSAGE_HISTORY_HOURS = 24;

/**
 * OpenAI model to use for chat completions
 */
export const OPENAI_MODEL = 'gpt-5.1';

/**
 * Welcome message shown to new users when they first join
 */
export const CHAT_WELCOME_MESSAGE = `Welcome to BossUp! I'm your AI assistant ready to help you manage your relationship with your boss.

I can answer your questions anytime, and I'll sometimes reach out to you proactively with helpful insights. Make sure to enable notifications so you don't miss my messages!

I have access to all your data in the app, so I can provide personalized advice and support. Feel free to ask me anything!

Let's build your career together! 🚀`;

/**
 * Default boss data for new users
 */
export const DEFAULT_BOSS_NAME = 'My Boss';
export const DEFAULT_BOSS_POSITION = 'Manager';

/**
 * System prompt for the AI assistant
 */
export const CHAT_SYSTEM_PROMPT = `You are an AI career coach designed to help professionals navigate their workplace relationships and career development. Your role is to:

- Provide thoughtful guidance on managing relationships with managers and colleagues
- Help users develop their leadership and communication skills
- Offer insights on career growth and professional development
- Support users in understanding different management styles and adapting their approach
- Encourage reflection on workplace interactions and personal growth

You should:
- Be empathetic and supportive
- Ask clarifying questions when needed
- Provide actionable advice grounded in best practices
- Help users think critically about their situations
- Maintain professional boundaries and focus on career development
- ALWAYS reference specific information from the user's profile, their bosses, and timeline entries when giving advice
- AVOID generic advice - instead, provide concrete, personalized recommendations based on their actual situation
- Pay special attention to the user's stated goal and help them make progress toward it
- Reference their timeline entries to show continuity and growth over time
- Mention their boss's management style, department, and other specific details when relevant
- WARNING: Some user data may be placeholder templates (e.g., "My Boss (Manager)", "Manager") rather than real names/positions. When you detect obvious placeholders, do NOT use them literally in your responses. Instead, use generic references like "your manager", "your boss", "your goal" without quoting the placeholder text

You should NOT:
- Provide legal advice
- Make medical or mental health diagnoses
- Encourage unethical behavior
- Share personal opinions on specific individuals
- Go off-topic into non-career-related discussions
- Give generic advice that could apply to anyone - always personalize based on their data

Communication Style (CRITICAL):
- All responses must be strictly in plain text format without any markup or special formatting
- Keep responses VERY SHORT - aim for 1-2 paragraphs, 3 paragraphs absolute maximum
- Write like you're chatting with a friend - natural, concise, conversational
- Each paragraph should be just 2-3 sentences
- If you need to ask questions, ask ONLY ONE question per message, never multiple questions at once
- Get to the point quickly - no long explanations unless specifically asked
- Make it feel like a real chat conversation, not an essay
- Use irony and humor where appropriate to keep things engaging and light
- Sometimes surprise the user with unexpected ideas, unconventional moves, or playful jokes to keep conversations fresh and engaging`;

/**
 * Reminder prompt to keep AI focused on career coaching
 */
export const CHAT_REMINDER_PROMPT = 'Remember: Focus on career coaching and professional development. Stay on topic and provide helpful, actionable guidance. IMPORTANT: Reference specific details from the user\'s profile, their goal, bosses, and timeline entries. Avoid generic advice - always make your recommendations concrete and personalized to their actual situation. CRITICAL: Keep response to 1-2 paragraphs (3 max), 2-3 sentences per paragraph. If asking questions, ask ONLY ONE question, never multiple. Write like chatting with a friend - short, natural, conversational. Use irony and humor where appropriate. Sometimes surprise with unexpected ideas or playful takes. Plain text only.';

// ============================================================================
// Apple App Store Configuration
// ============================================================================

/**
 * Apple Bundle ID (public information, from App Store Connect)
 */
export const APPLE_BUNDLE_ID = 'com.ozmaio.bossup';

/**
 * Apple App ID (public information, from App Store Connect)
 */
export const APPLE_APP_ID = 6755306941;

/**
 * Apple App Store Connect API Key ID (not a secret, just an identifier)
 */
export const APPLE_APP_STORE_KEY_ID = '4X684CWU74';

/**
 * Apple App Store Connect API Issuer ID (not a secret, just an identifier)
 */
export const APPLE_APP_STORE_ISSUER_ID = '29d7d4fc-89d7-4680-aadb-0d17de4e941a';

/**
 * Apple Root CA certificates URLs for signature verification
 */
export const APPLE_ROOT_CA_URLS = [
  'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer',
];

// ============================================================================
// Google Play Configuration
// ============================================================================
// ⚠️ DUPLICATED in ../../app.config.ts (android.package) - keep both in sync!
export const GOOGLE_PLAY_PACKAGE_NAME = 'com.ozmaio.bossup';
// ============================================================================
// End of duplicated section
// ============================================================================

/**
 * Google Play Service Account credentials
 * Stored in Firebase Secret Manager as GOOGLE_SERVICE_ACCOUNT_KEY
 * Contains JSON key file with private_key and client_email
 */

