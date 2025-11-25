/**
 * Email Sender Cloud Function
 * 
 * Firestore trigger that listens to email documents and sends them via Mailgun.
 * Triggered when a document is created or updated in users/{userId}/emails/{emailId}
 */

import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import Mailgun from 'mailgun.js';
import { renderEmailTemplate } from './email-template';
import { logger } from './logger';
import { markdownToHtml } from './markdown-renderer';

// Define Mailgun API key secret
const mailgunApiKey = defineSecret('MAILGUN_API_KEY');

// Mailgun configuration
const MAILGUN_DOMAIN = 'mailgun.services.ozma.io';
const MAILGUN_FROM = 'BossUp <hello@ozma.io>';

interface EmailDocument {
  to: string;
  subject: string;
  body_markdown: string;
  state: 'PLANNED' | 'SENDING' | 'SENT' | 'FAILED';
  sentAt?: string;
  lastErrorMessage?: string;
  createdAt: string;
}

/**
 * Handle email document creation
 * Triggers when a new email document is created
 */
export const onEmailCreated = onDocumentCreated(
  {
    document: 'users/{userId}/emails/{emailId}',
    region: 'us-central1',
    secrets: [mailgunApiKey],
  },
  async (event) => {
    const userId = event.params.userId;
    const emailId = event.params.emailId;
    const emailData = event.data?.data() as EmailDocument;

    if (!emailData) {
      logger.error('No email data found', { feature: 'EmailSender', userId, emailId });
      return;
    }

    logger.info('Email document created', { feature: 'EmailSender', userId, emailId, state: emailData.state });

    // Only process if state is PLANNED
    if (emailData.state === 'PLANNED') {
      await sendEmail(userId, emailId, emailData);
    }
  }
);

/**
 * Handle email document updates
 * Triggers when an email document is updated (for retry logic)
 */
export const onEmailUpdated = onDocumentUpdated(
  {
    document: 'users/{userId}/emails/{emailId}',
    region: 'us-central1',
    secrets: [mailgunApiKey],
  },
  async (event) => {
    const userId = event.params.userId;
    const emailId = event.params.emailId;
    const emailData = event.data?.after.data() as EmailDocument;

    if (!emailData) {
      logger.error('No email data found', { feature: 'EmailSender', userId, emailId });
      return;
    }

    // Only process if state changed to PLANNED (for retries)
    const previousState = (event.data?.before.data() as EmailDocument)?.state;
    if (emailData.state === 'PLANNED' && previousState !== 'PLANNED') {
      logger.info('Email document updated to PLANNED, retrying send', {
        feature: 'EmailSender',
        userId,
        emailId,
        previousState,
      });
      await sendEmail(userId, emailId, emailData);
    }
  }
);

/**
 * Send email via Mailgun
 */
async function sendEmail(userId: string, emailId: string, emailData: EmailDocument): Promise<void> {
  const emailRef = admin.firestore().collection('users').doc(userId).collection('emails').doc(emailId);

  try {
    // Update state to SENDING (use transaction to prevent double-sending)
    await admin.firestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(emailRef);
      const currentData = doc.data() as EmailDocument;

      // Only proceed if still in PLANNED state
      if (currentData.state !== 'PLANNED') {
        logger.info('Email state changed, skipping send', {
          feature: 'EmailSender',
          userId,
          emailId,
          currentState: currentData.state,
        });
        return;
      }

      transaction.update(emailRef, {
        state: 'SENDING',
      });
    });

    logger.info('Sending email via Mailgun', {
      feature: 'EmailSender',
      userId,
      emailId,
      to: emailData.to,
      subject: emailData.subject,
      bodyLength: emailData.body_markdown.length,
    });

    // Convert Markdown to HTML
    const bodyHtml = markdownToHtml(emailData.body_markdown);
    
    // Wrap in email template
    const html = renderEmailTemplate(emailData.subject, bodyHtml);

    // Initialize Mailgun client with API key from Secret Manager
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: 'api',
      key: mailgunApiKey.value(),
    });

    // Send email via Mailgun
    const result = await mg.messages.create(MAILGUN_DOMAIN, {
      from: MAILGUN_FROM,
      to: emailData.to,
      subject: emailData.subject,
      html: html,
    });

    logger.info('Email sent successfully via Mailgun', {
      feature: 'EmailSender',
      userId,
      emailId,
      mailgunId: result.id,
    });

    // Update state to SENT
    await emailRef.update({
      state: 'SENT',
      sentAt: new Date().toISOString(),
      lastErrorMessage: admin.firestore.FieldValue.delete(),
    });
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send email', {
      feature: 'EmailSender',
      userId,
      emailId,
      error: err,
    });

    // Update state to FAILED
    await emailRef.update({
      state: 'FAILED',
      lastErrorMessage: err.message || 'Unknown error',
    });
  }
}

