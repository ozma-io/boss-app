import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as jwt from 'jsonwebtoken';

const INTERCOM_SECRET = process.env.INTERCOM_SECRET_KEY;

/**
 * Generate JWT token for Intercom authentication
 * This token is used to securely authenticate users in Intercom messenger
 * preventing user impersonation attacks
 */
export const getIntercomJwt = onCall(
  { 
    region: 'us-central1',
    cors: true,
    secrets: ['INTERCOM_SECRET_KEY'],
  },
  async (request) => {
    console.log('[getIntercomJwt] Function called');
    
    if (!request.auth) {
      console.error('[getIntercomJwt] No auth in request');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = request.auth.uid;
    const email = request.auth.token.email;
    
    console.log('[getIntercomJwt] User ID:', userId);
    console.log('[getIntercomJwt] Email:', email);
    console.log('[getIntercomJwt] Secret configured:', !!INTERCOM_SECRET);
    
    if (!INTERCOM_SECRET) {
      console.error('[getIntercomJwt] Intercom secret not configured');
      throw new HttpsError('internal', 'Intercom secret not configured');
    }
    
    // Intercom Identity Verification JWT payload
    // Must include user_id (required) and email (recommended for mobile)
    const payload = {
      user_id: userId,
      email: email,
    };
    
    console.log('[getIntercomJwt] Generating JWT with payload:', payload);
    const token = jwt.sign(payload, INTERCOM_SECRET, { algorithm: 'HS256' });
    console.log('[getIntercomJwt] JWT generated successfully, length:', token.length);
    
    return { token };
  }
);

