import * as Updates from 'expo-updates';
import { logger } from './logger.service';

// Timeout for update check (3 seconds)
// If network is slow, we don't want to block app startup
const UPDATE_CHECK_TIMEOUT_MS = 3000;

// Error messages for timeout scenarios
const UPDATE_CHECK_TIMEOUT_ERROR = 'Update check timed out';
const UPDATE_FETCH_TIMEOUT_ERROR = 'Update fetch timed out';

/**
 * Helper function to run a promise with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

/**
 * Checks for available updates and applies them
 * 
 * If the check or download times out, automatically falls back to background update check
 * without timeout, ensuring updates will still be downloaded when network is available.
 * 
 * @param force - If true, forces immediate app reload with the new update
 *                If false, update will be applied on next app restart (softer UX)
 * @param timeoutMs - Timeout in milliseconds (default: 3000ms). If check takes longer, it will be cancelled
 *                    and background check will be started as fallback.
 * @returns Promise<boolean> - true if update was found and downloaded, false otherwise
 */
export async function checkAndApplyUpdates(
  force: boolean,
  timeoutMs: number = UPDATE_CHECK_TIMEOUT_MS
): Promise<boolean> {
  try {
    // Check if Updates are enabled (disabled in dev mode)
    if (!Updates.isEnabled) {
      logger.info('Updates disabled (dev mode or not configured)', { 
        feature: 'Updates' 
      });
      return false;
    }

    logger.info('Checking for updates...', { feature: 'Updates', timeoutMs });
    
    // Check for updates with timeout to avoid blocking app startup on slow networks
    const update = await withTimeout(
      Updates.checkForUpdateAsync(),
      timeoutMs,
      UPDATE_CHECK_TIMEOUT_ERROR
    );
    
    if (update.isAvailable) {
      logger.info('Update available, downloading...', { 
        feature: 'Updates',
        manifestString: update.manifest ? JSON.stringify(update.manifest) : undefined
      });
      
      // Fetch update with a longer timeout (download can take more time)
      await withTimeout(
        Updates.fetchUpdateAsync(),
        timeoutMs * 4, // 4x timeout for actual download
        UPDATE_FETCH_TIMEOUT_ERROR
      );
      
      if (force) {
        // Force reload with new update immediately
        logger.info('Force reloading with new update', { 
          feature: 'Updates' 
        });
        await Updates.reloadAsync();
        return true;
      } else {
        // Soft update - will apply on next app restart
        logger.info('Update downloaded, will apply on next restart', { 
          feature: 'Updates' 
        });
        return true;
      }
    } else {
      logger.info('No updates available', { feature: 'Updates' });
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCheckTimeout = errorMessage.includes(UPDATE_CHECK_TIMEOUT_ERROR);
    const isFetchTimeout = errorMessage.includes(UPDATE_FETCH_TIMEOUT_ERROR);
    
    if (isCheckTimeout) {
      logger.error('Update check timed out, UPDATE_CHECK_TIMEOUT_MS constant may need adjustment', { 
        feature: 'Updates',
        timeoutMs,
        currentTimeout: UPDATE_CHECK_TIMEOUT_MS,
        errorMessage,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Fallback: Start background update check without timeout
      logger.info('Starting background update check as fallback', { feature: 'Updates' });
      checkUpdatesInBackground().catch((bgError) => {
        logger.error('Background update check failed to start', { 
          feature: 'Updates', 
          error: bgError instanceof Error ? bgError : new Error(String(bgError))
        });
      });
    } else if (isFetchTimeout) {
      logger.error('Update download timed out, fetch timeout constant may need adjustment', { 
        feature: 'Updates',
        checkTimeout: timeoutMs,
        fetchTimeout: timeoutMs * 4,
        errorMessage,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Fallback: Start background update check without timeout
      logger.info('Starting background update check as fallback', { feature: 'Updates' });
      checkUpdatesInBackground().catch((bgError) => {
        logger.error('Background update check failed to start', { 
          feature: 'Updates', 
          error: bgError instanceof Error ? bgError : new Error(String(bgError))
        });
      });
    } else {
      logger.error('Failed to check for updates', { 
        feature: 'Updates',
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
    
    // Always return false on error - don't block app startup
    return false;
  }
}

/**
 * Checks for updates in the background without timeout
 * This is a fallback when the synchronous check times out
 * Runs silently in the background without blocking app startup
 */
export async function checkUpdatesInBackground(): Promise<void> {
  try {
    if (!Updates.isEnabled) {
      return;
    }

    logger.info('Starting background update check (no timeout)', { feature: 'Updates' });
    
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      logger.info('Background check: Update available, downloading...', { 
        feature: 'Updates',
        manifestString: update.manifest ? JSON.stringify(update.manifest) : undefined
      });
      
      await Updates.fetchUpdateAsync();
      
      logger.info('Background update downloaded successfully, will apply on next restart', { 
        feature: 'Updates' 
      });
    } else {
      logger.info('Background check: No updates available', { feature: 'Updates' });
    }
  } catch (error) {
    logger.error('Background update check failed', { 
      feature: 'Updates',
      error: error instanceof Error ? error : new Error(String(error))
    });
  }
}

/**
 * Gets current update information
 */
export async function getCurrentUpdateInfo(): Promise<{
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  isEmbeddedLaunch: boolean;
}> {
  try {
    const updateInfo = {
      updateId: Updates.updateId,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    };
    
    logger.info('Current update info', { feature: 'Updates', ...updateInfo });
    
    return updateInfo;
  } catch (error) {
    logger.error('Failed to get current update info', { 
      feature: 'Updates',
      error: error instanceof Error ? error : new Error(String(error))
    });
    
    return {
      updateId: null,
      channel: null,
      runtimeVersion: null,
      isEmbeddedLaunch: true,
    };
  }
}

