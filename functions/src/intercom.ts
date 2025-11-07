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
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = request.auth.uid;
    const email = request.auth.token.email;
    
    if (!INTERCOM_SECRET) {
      throw new HttpsError('internal', 'Intercom secret not configured');
    }
    
    const payload = {
      user_id: userId,
      email: email,
    };
    
    const token = jwt.sign(payload, INTERCOM_SECRET, { expiresIn: '1h' });
    
    return { token };
  }
);

