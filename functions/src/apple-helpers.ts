/**
 * Apple App Store Helper Functions
 * 
 * Shared utilities for working with Apple App Store Server API
 */

import * as https from 'https';
import { APPLE_ROOT_CA_URLS } from './constants';
import { logger } from './logger';

/**
 * Download Apple Root CA certificates
 * These are needed to verify signed data from Apple
 */
export async function downloadAppleRootCertificates(): Promise<Buffer[]> {
  const certificates: Buffer[] = [];
  
  for (const url of APPLE_ROOT_CA_URLS) {
    try {
      const certBuffer = await new Promise<Buffer>((resolve, reject) => {
        https.get(url, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        }).on('error', reject);
      });
      certificates.push(certBuffer);
    } catch (error) {
      logger.warn('Failed to download Apple root certificate', { url, error });
    }
  }
  
  return certificates;
}

