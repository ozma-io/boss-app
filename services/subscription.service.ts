import { SubscriptionBillingPeriod, UserProfile } from '@/types';

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(profile: UserProfile | null): boolean {
  if (!profile || !profile.subscription) return false;
  
  const { status, currentPeriodEnd } = profile.subscription;
  
  // Active statuses
  if (status === 'active' || status === 'trial' || status === 'grace_period') {
    // Check if period hasn't expired
    if (currentPeriodEnd) {
      const now = new Date();
      const endDate = new Date(currentPeriodEnd);
      return endDate > now;
    }
    return true;
  }
  
  return false;
}

/**
 * Get display info for subscription screen
 */
export function getSubscriptionDisplayInfo(profile: UserProfile | null) {
  const sub = profile?.subscription;
  
  if (!sub || sub.status === 'none') {
    return {
      hasSubscription: false,
      displayText: 'No active subscription',
      showPlans: true,
      buttonText: 'Subscribe',
    };
  }
  
  const isActive = hasActiveSubscription(profile);
  
  return {
    hasSubscription: isActive,
    tier: sub.tier || 'basic',
    billingPeriod: sub.billingPeriod,
    status: sub.status,
    nextPaymentDate: sub.currentPeriodEnd,
    priceAmount: sub.priceAmount,
    priceCurrency: sub.priceCurrency || 'USD',
    billingCycleMonths: sub.billingCycleMonths,
    displayText: formatSubscriptionText(sub),
    showPlans: true,
    buttonText: isActive ? 'Change plan' : 'Subscribe',
  };
}

/**
 * Format subscription text for display
 */
function formatSubscriptionText(sub: UserProfile['subscription']): string {
  if (!sub) return '';
  
  const tierName = sub.tier ? capitalize(sub.tier) : 'Basic';
  const periodName = sub.billingPeriod ? formatBillingPeriodLabel(sub.billingPeriod) : '';
  const price = sub.priceAmount ? formatPrice(sub.priceAmount, sub.priceCurrency || 'USD') : '';
  
  return `${tierName} ${periodName} - ${price}`;
}

/**
 * Format billing period for display
 */
export function formatBillingPeriodLabel(period: SubscriptionBillingPeriod): string {
  switch (period) {
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'semiannual':
      return 'Semi-Annual';
    case 'annual':
      return 'Annual';
    case 'lifetime':
      return 'Lifetime';
    default:
      return capitalize(period);
  }
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  
  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${amount}`;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get billing period description for UI
 */
export function getBillingPeriodDescription(period: SubscriptionBillingPeriod, cycleMonths: number): string {
  switch (period) {
    case 'monthly':
      return 'per month';
    case 'quarterly':
      return 'every 3 months';
    case 'semiannual':
      return 'every 6 months';
    case 'annual':
      return 'per year';
    case 'lifetime':
      return 'one-time payment';
    default:
      return cycleMonths === 1 ? 'per month' : `every ${cycleMonths} months`;
  }
}

/**
 * Format next payment date for display
 */
export function formatNextPaymentDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    return dateString;
  }
}

