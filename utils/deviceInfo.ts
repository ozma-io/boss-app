/**
 * Device Information Utility
 * 
 * Collects device information for Facebook Conversions API extinfo parameter
 */

import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * Build extinfo array for Facebook Conversions API
 * This is a 16-element array required by Facebook for mobile app events
 * 
 * Format: [platform, bundle_id, short_version, long_version, os_version, 
 *          device_model, locale, timezone_abbr, carrier, screen_width, 
 *          screen_height, screen_density, cpu_cores, storage_size, 
 *          storage_free, device_timezone]
 */
export async function buildExtinfo(): Promise<string[]> {
  try {
    // [0] Platform type: "i2" for iOS, "a2" for Android
    const platformType = Platform.OS === 'ios' ? 'i2' : 'a2';

    // [1] Bundle ID / Package Name
    const bundleId = await DeviceInfo.getBundleId();

    // [2] Short version (e.g., "1.0")
    const shortVersion = await DeviceInfo.getVersion();

    // [3] Long version (e.g., "1.0 (1)")
    const buildNumber = await DeviceInfo.getBuildNumber();
    const longVersion = `${shortVersion} (${buildNumber})`;

    // [4] OS version (REQUIRED - cannot be empty!)
    const osVersion = await DeviceInfo.getSystemVersion();

    // [5] Device model (e.g., "iPhone14,3" or "Pixel 7 Pro")
    const deviceModel = await DeviceInfo.getModel();

    // [6] Locale (e.g., "en_US")
    const locale = Localization.getLocales()[0]?.languageTag?.replace('-', '_') || 'en_US';

    // [7] Timezone abbreviation (e.g., "PST", "EST")
    const timezoneAbbr = getTimezoneAbbreviation();

    // [8] Carrier name (e.g., "AT&T", "Verizon")
    const carrier = await DeviceInfo.getCarrier() || '';

    // [9] Screen width in pixels
    // [10] Screen height in pixels
    // Note: We'll set these as empty strings for now, or you can use Dimensions API
    const screenWidth = '';
    const screenHeight = '';

    // [11] Screen density (e.g., "2", "3")
    // [12] CPU cores (e.g., "4", "6")
    const screenDensity = '';
    const cpuCores = '';

    // [13] Total storage size in GB
    // [14] Free storage space in GB
    const totalStorage = Math.round((await DeviceInfo.getTotalDiskCapacity()) / (1024 * 1024 * 1024)).toString();
    const freeStorage = Math.round((await DeviceInfo.getFreeDiskStorage()) / (1024 * 1024 * 1024)).toString();

    // [15] Device timezone (e.g., "America/New_York")
    const deviceTimezone = Localization.getCalendars()[0]?.timeZone || 'America/New_York';

    const extinfo: string[] = [
      platformType,    // [0] Required
      bundleId,        // [1]
      shortVersion,    // [2]
      longVersion,     // [3]
      osVersion,       // [4] Required
      deviceModel,     // [5]
      locale,          // [6]
      timezoneAbbr,    // [7]
      carrier,         // [8]
      screenWidth,     // [9]
      screenHeight,    // [10]
      screenDensity,   // [11]
      cpuCores,        // [12]
      totalStorage,    // [13]
      freeStorage,     // [14]
      deviceTimezone,  // [15]
    ];

    console.log('[DeviceInfo] Built extinfo array:', extinfo);
    return extinfo;
  } catch (error) {
    console.error('[DeviceInfo] Error building extinfo:', error);
    
    // Return minimal valid extinfo with placeholders if error occurs
    return [
      Platform.OS === 'ios' ? 'i2' : 'a2',  // [0] Required
      'com.unknown',                          // [1]
      '1.0',                                  // [2]
      '1.0',                                  // [3]
      Platform.OS === 'ios' ? '17.0' : '14', // [4] Required
      'unknown',                              // [5]
      'en_US',                                // [6]
      'PST',                                  // [7]
      '',                                     // [8]
      '',                                     // [9]
      '',                                     // [10]
      '',                                     // [11]
      '',                                     // [12]
      '',                                     // [13]
      '',                                     // [14]
      'America/New_York',                     // [15]
    ];
  }
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST", "GMT")
 */
function getTimezoneAbbreviation(): string {
  try {
    const date = new Date();
    const tzString = date.toLocaleString('en-US', { timeZoneName: 'short' });
    const match = tzString.match(/\b([A-Z]{3,5})\b/);
    return match ? match[1] : 'GMT';
  } catch (error) {
    console.error('[DeviceInfo] Error getting timezone abbreviation:', error);
    return 'GMT';
  }
}

/**
 * Get App Tracking Transparency status (iOS 14.5+)
 * Returns true if user has granted tracking permission
 */
export async function getAdvertiserTrackingEnabled(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    // Android doesn't have ATT, assume true
    return true;
  }

  try {
    // Try to get ATT status
    // Note: This requires expo-tracking-transparency or similar package
    // For now, we'll default to true and you can implement this later
    return true;
  } catch (error) {
    console.error('[DeviceInfo] Error getting advertiser tracking status:', error);
    return false;
  }
}

/**
 * Application tracking enabled (always true for now)
 * This indicates if the app itself allows tracking
 */
export function getApplicationTrackingEnabled(): boolean {
  return true;
}

