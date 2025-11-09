import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as jwt from 'jsonwebtoken';

const intercomSecret = defineSecret('INTERCOM_SECRET_KEY');

/**
 * Generate JWT token for Intercom authentication
 * This token is used to securely authenticate users in Intercom messenger
 * preventing user impersonation attacks
 */
export const getIntercomJwt = onCall(
  { 
    region: 'us-central1',
    cors: true,
    secrets: [intercomSecret],
  },
  async (request) => {
    console.log('[getIntercomJwt] Function called');
    
    if (!request.auth) {
      console.error('[getIntercomJwt] No auth in request');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = request.auth.uid;
    const email = request.auth.token.email;
    
    const secretValue = intercomSecret.value().trim();
    
    console.log('[getIntercomJwt] User ID:', userId);
    console.log('[getIntercomJwt] Email:', email);
    console.log('[getIntercomJwt] Secret configured:', !!secretValue);
    console.log('[getIntercomJwt] Secret length:', secretValue?.length);
    console.log('[getIntercomJwt] Secret first 4 chars:', secretValue?.substring(0, 4));
    console.log('[getIntercomJwt] Secret last 4 chars:', secretValue?.substring(secretValue.length - 4));
    
    if (!secretValue) {
      console.error('[getIntercomJwt] Intercom secret not configured');
      throw new HttpsError('internal', 'Intercom secret not configured');
    }
    
    if (secretValue.length !== 43) {
      console.error('[getIntercomJwt] Secret length is unexpected:', secretValue.length, 'expected 43');
    }
    
    // Intercom Messenger Security JWT payload
    // Reference: https://help.intercom.com/en/articles/183-authenticating-users-in-the-messenger-with-json-web-tokens-jwts
    // user_id is REQUIRED, email is recommended
    const payload = {
      user_id: userId,
      email: email,
    };
    
    console.log('[getIntercomJwt] Generating JWT with payload:', payload);
    // Set expiration to 1 hour (recommended minimum is 5 minutes)
    // Intercom docs: "Choose the minimum duration that is suitable for their application's behavior"
    const token = jwt.sign(payload, secretValue, { 
      algorithm: 'HS256',
      expiresIn: '1h'
    });
    console.log('[getIntercomJwt] JWT generated successfully, length:', token.length);
    
    // Verify the JWT by decoding it (without verification to see the payload)
    const decoded = jwt.decode(token, { complete: true });
    console.log('[getIntercomJwt] Decoded JWT header:', decoded?.header);
    console.log('[getIntercomJwt] Decoded JWT payload:', decoded?.payload);
    
    // Verify the JWT with the secret to ensure it's valid
    try {
      const verified = jwt.verify(token, secretValue, { algorithms: ['HS256'] });
      console.log('[getIntercomJwt] JWT verification successful:', verified);
    } catch (verifyError) {
      console.error('[getIntercomJwt] JWT verification FAILED:', verifyError);
      throw new HttpsError('internal', 'Failed to verify generated JWT');
    }
    
    return { token };
  }
);

