import * as WebBrowser from 'expo-web-browser';

// TODO: Replace with actual privacy policy and terms of service URLs
const PRIVACY_POLICY_URL = 'https://example.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://example.com/terms';

export async function openPrivacyPolicy(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
  } catch (error) {
    console.error('Failed to open Privacy Policy:', error);
    throw new Error('Failed to open Privacy Policy');
  }
}

export async function openTermsOfService(): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(TERMS_OF_SERVICE_URL);
  } catch (error) {
    console.error('Failed to open Terms of Service:', error);
    throw new Error('Failed to open Terms of Service');
  }
}

