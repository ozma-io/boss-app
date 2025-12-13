import { logger } from '@/services/logger.service'

/**
 * Validates and normalizes Facebook event timestamp according to Facebook Conversions API requirements.
 *
 * This function ensures timestamps meet Facebook's requirements:
 * - Must be Unix timestamp in SECONDS (not milliseconds)
 * - Must not be in the future (allows 60s tolerance for clock skew)
 * - Must not be older than 7 days (Facebook requirement)
 *
 * Use this function in ALL places where Facebook events are sent (client & server)
 * to ensure consistent timestamps for proper event deduplication.
 *
 * Usage:
 * ```typescript
 * // Client-side (React Native)
 * const eventTime = validateFacebookEventTime(Math.floor(Date.now() / 1000), 'AppInstall')
 *
 * // Server-side (Cloud Functions)
 * const eventTime = validateFacebookEventTime(clientEventTime, 'Purchase')
 * ```
 *
 * @param eventTime - Unix timestamp (can be in seconds or milliseconds)
 * @param eventName - Event name for logging context (optional)
 * @returns Validated Unix timestamp in seconds
 */
export function validateFacebookEventTime(
  eventTime: number | undefined,
  eventName?: string
): number {
  let eventTimeInSeconds = eventTime
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const sevenDaysInSeconds = 7 * 24 * 60 * 60

  if (eventTimeInSeconds !== undefined) {
    // Convert milliseconds to seconds if needed (JavaScript Date.now() returns milliseconds)
    if (eventTimeInSeconds > 10000000000) {
      logger.debug('Converting event timestamp from milliseconds to seconds', {
        originalValue: eventTimeInSeconds,
        convertedValue: Math.floor(eventTimeInSeconds / 1000),
        eventName,
      })
      eventTimeInSeconds = Math.floor(eventTimeInSeconds / 1000)
    }

    // Handle future timestamps (likely clock skew)
    if (eventTimeInSeconds > nowInSeconds + 60) {
      const differenceInSeconds = eventTimeInSeconds - nowInSeconds
      logger.warn('Event timestamp in future, adjusting to current time', {
        clientTime: eventTimeInSeconds,
        serverTime: nowInSeconds,
        differenceInSeconds,
        eventName,
      })
      // Use current time as most probable value
      eventTimeInSeconds = nowInSeconds
    }

    // Handle timestamps older than 7 days (Facebook rejects these)
    if (eventTimeInSeconds < nowInSeconds - sevenDaysInSeconds) {
      const ageInDays = (nowInSeconds - eventTimeInSeconds) / (24 * 60 * 60)
      logger.warn('Event timestamp too old (>7 days), using current time', {
        clientTime: eventTimeInSeconds,
        serverTime: nowInSeconds,
        ageInDays: ageInDays.toFixed(1),
        eventName,
      })
      // Use current time as fallback
      eventTimeInSeconds = nowInSeconds
    }
  } else {
    // No client time provided, use current time
    eventTimeInSeconds = nowInSeconds
  }

  return eventTimeInSeconds
}

