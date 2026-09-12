import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { adminFirestore } from '@/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GMAIL_USER = process.env.GMAIL_SENDER_EMAIL; // The account used to send
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://zeneva.space';

export interface FollowUpParams {
  to: string;
  name: string;
  subject: string;
  body: string; // HTML body
  businessId?: string;
  type?: string;
}

/**
 * Sends a follow-up email via Gmail API with 1x1 tracking pixel.
 */
export async function sendGmailFollowUp(params: FollowUpParams, retryCount = 0): Promise<string> {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER) {
    throw new Error('Gmail API credentials are not fully configured in environment variables.');
  }

  const trackId = uuidv4();
  
  // 1. Create Log document in Firestore (Start as pending)
  await adminFirestore.collection('follow_up_logs').doc(trackId).set({
    sentTo: params.to,
    recipientName: params.name,
    subject: params.subject,
    sentAt: new Date(),
    status: 'pending',
    businessId: params.businessId || 'unknown',
    type: params.type || 'follow-up',
    openCount: 0
  });

  // 2. Inject Tracking Pixel
  const trackingPixel = `<img src="${BASE_URL}/api/track?tid=${trackId}" width="1" height="1" style="display:none;" />`;
  const htmlWithPixel = `${params.body}${trackingPixel}`;

  // 3. Setup OAuth2
  const OAuth2 = google.auth.OAuth2;
  const oauth2Client = new OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN
  });

  try {
    // We create the transporter but let Nodemailer handle the token refresh
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: GMAIL_USER,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN,
      }
    });

    // 4. Send Email
    const info = await transporter.sendMail({
      from: `Zeneva Success Team <${GMAIL_USER}>`,
      to: params.to,
      subject: params.subject,
      html: htmlWithPixel,
    });

    console.log('Email sent: %s', info.messageId);
    
    // Update log to sent on SUCCESS
    await adminFirestore.collection('follow_up_logs').doc(trackId).update({
      status: 'sent'
    });

    return trackId;

  } catch (error: any) {
    console.error(`Attempt ${retryCount + 1} failed sending email to ${params.to}:`, error.message);

    // DNS / Network Retry Logic
    if (retryCount < 3 && (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN' || error.syscall === 'getaddrinfo')) {
      const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return sendGmailFollowUp(params, retryCount + 1);
    }

    // Update log to failed if final attempt
    await adminFirestore.collection('follow_up_logs').doc(trackId).update({
      status: 'failed',
      error: error.message
    });

    throw error;
  }
}
