import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as jwt from 'jsonwebtoken';
import { logger } from './logger';

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
    logger.debug('Intercom JWT function called', {});
    
    if (!request.auth) {
      logger.error('Intercom JWT no auth in request', {});
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const userId = request.auth.uid;
    const email = request.auth.token.email;
    
    const secretValue = intercomSecret.value().trim();
    
    logger.debug('Intercom JWT processing', {
      userId,
      email,
      hasSecret: !!secretValue,
      secretLength: secretValue?.length,
      secretFirst4: secretValue?.substring(0, 4),
      secretLast4: secretValue?.substring(secretValue.length - 4),
    });
    
    if (!secretValue) {
      logger.error('Intercom secret not configured', {});
      throw new HttpsError('internal', 'Intercom secret not configured');
    }
    
    if (secretValue.length !== 43) {
      logger.warn('Intercom secret length unexpected', {
        actualLength: secretValue.length,
        expectedLength: 43,
      });
    }
    
    // Intercom Messenger Security JWT payload
    // Reference: https://help.intercom.com/en/articles/183-authenticating-users-in-the-messenger-with-json-web-tokens-jwts
    // user_id is REQUIRED, email is recommended
    const payload = {
      user_id: userId,
      email: email,
    };
    
    logger.debug('Intercom generating JWT with payload', { payload });
    // Set expiration to 1 hour (recommended minimum is 5 minutes)
    // Intercom docs: "Choose the minimum duration that is suitable for their application's behavior"
    const token = jwt.sign(payload, secretValue, { 
      algorithm: 'HS256',
      expiresIn: '1h'
    });
    logger.debug('Intercom JWT generated successfully', { tokenLength: token.length });
    
    // Verify the JWT with the secret to ensure it's valid
    try {
      jwt.verify(token, secretValue, { algorithms: ['HS256'] });
      logger.debug('Intercom JWT verification successful', {});
    } catch (verifyError) {
      logger.error('Intercom JWT verification failed', { verifyError });
      throw new HttpsError('internal', 'Failed to verify generated JWT');
    }
    
    return { token };
  }
);

