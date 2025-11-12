import * as WebBrowser from 'expo-web-browser';
import { logger } from '@/services/logger.service';

const PRIVACY_POLICY_URL = 'https://www.iubenda.com/privacy-policy/44080391';
const TERMS_OF_SERVICE_URL = 'https://www.iubenda.com/terms-and-conditions/44080391';

export async function openPrivacyPolicy(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  } catch (error) {
    logger.error('Failed to open Privacy Policy', { feature: 'Policy', error });
    throw new Error('Failed to open Privacy Policy');
  }
}

export async function openTermsOfService(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
  } catch (error) {
    logger.error('Failed to open Terms of Service', { feature: 'Policy', error });
    throw new Error('Failed to open Terms of Service');
  }
}

