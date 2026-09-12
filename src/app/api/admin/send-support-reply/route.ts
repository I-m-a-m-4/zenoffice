import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/server/resend';
import { requireSuperAdmin, corsHeaders } from '../_guard';
import { AppConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.res;

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  try {
    const { to, userName, subject, message, mediaUrl, mediaUrls, messages } = body ?? {};

    if (!to || (!message && !mediaUrl && (!messages || messages.length === 0))) {
      return NextResponse.json(
        { message: 'Missing required fields: to, message or messages' },
        { status: 400, headers: corsHeaders }
      );
    }

    const emailSubject = subject ? `Re: ${subject} - Zeneva Support` : 'Response from Zeneva Support';
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://zeneva.space').replace(/\/+$/, '');

    // Web CDN icon links for crisp email rendering
    const xIcon = 'https://cdn-icons-png.flaticon.com/512/5969/5969020.png';
    const igIcon = 'https://cdn-icons-png.flaticon.com/512/174/174855.png';
    const inIcon = 'https://cdn-icons-png.flaticon.com/512/174/174857.png';

    // Collect all media URLs into an array
    const allMediaUrls: string[] = [];
    if (mediaUrl) allMediaUrls.push(mediaUrl);
    if (Array.isArray(mediaUrls)) allMediaUrls.push(...mediaUrls.filter(Boolean));
    if (Array.isArray(messages)) {
      messages.forEach((m: any) => {
        if (m.mediaUrl && !allMediaUrls.includes(m.mediaUrl)) {
          allMediaUrls.push(m.mediaUrl);
        }
      });
    }

    // Format body text from single message or bulk messages array
    let formattedBodyHtml = '';
    if (Array.isArray(messages) && messages.length > 0) {
      const combinedText = messages.map((m: any) => m.text ? m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '').filter(Boolean).join('<br/><br/>');
      if (combinedText) {
        formattedBodyHtml = `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafaf9; border: 1px solid #f5f5f4; border-radius: 14px; margin-bottom: 24px;">
            <tr>
              <td style="padding: 20px; font-size: 14px; line-height: 1.6; color: #1c1917; white-space: pre-wrap;">${combinedText}</td>
            </tr>
          </table>
        `;
      }
    } else if (message) {
      formattedBodyHtml = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafaf9; border: 1px solid #f5f5f4; border-radius: 14px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px; font-size: 14px; line-height: 1.6; color: #1c1917; white-space: pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          </tr>
        </table>
      `;
    }

    // Render remaining standalone images if any
    let mediaGalleryHtml = '';
    if (allMediaUrls.length > 0 && (!messages || messages.length === 0)) {
      mediaGalleryHtml = allMediaUrls.map((url: string) => `
        <div style="margin-bottom: 16px; border: 1px solid #e7e5e4; border-radius: 14px; overflow: hidden; background-color: #fafaf9; padding: 12px; text-align: center;">
          <img src="${url}" alt="Attachment" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px; display: inline-block;" />
        </div>
      `).join('');
    }

    // Elegant Plud-Inspired Email Layout with Orange (#ea580c) & Hero Dark Navy Blue (#1e293b) Top Border
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style="margin: 0; padding: 40px 16px; background-color: #f5f5f4; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td align="center">
              <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="width: 580px; max-width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e7e5e4; box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
                
                <!-- TOP BORDER STRIPE: 75% ZENEVA ORANGE (#ea580c), 25% HERO DARK NAVY BLUE (#1e293b) -->
                <tr>
                  <td style="padding: 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="height: 5px;">
                      <tr>
                        <td width="75%" style="background-color: #ea580c; height: 5px;"></td>
                        <td width="25%" style="background-color: #1e293b; height: 5px;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- HEADER & MAIN BODY CONTENT -->
                <tr>
                  <td style="padding: 40px 40px 32px 40px; background-color: #ffffff;">
                    
                    <!-- BRAND LOGO (3D Shape Mark — circle + crescent, no wordmark) -->
                    <div style="margin-bottom: 28px; text-align: center;">
                      <img src="https://i.ibb.co/tMp65gRP/5c1014423d18.png" alt="Zeneva" width="72" height="72" style="width: 72px; height: 72px; object-fit: contain; display: inline-block; border: 0; outline: none; text-decoration: none;" />
                    </div>


                    <!-- SUBTITLE & TITLE -->
                    <div style="font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">
                      A Note From Zeneva CEO
                    </div>
                    <h1 style="margin: 0 0 20px 0; font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 800; color: #1c1917; line-height: 1.3;">
                      Response to your support ticket
                    </h1>

                    <p style="margin: 0 0 16px 0; font-size: 15px; color: #44403c; line-height: 1.6;">
                      Hi <strong>${userName || 'Valued Partner'}</strong>,
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #57534e; line-height: 1.6;">
                      Here are the updates regarding your inquiry:
                    </p>

                    <!-- MESSAGE CONTENT CARDS -->
                    ${formattedBodyHtml}
                    ${mediaGalleryHtml}

                    <!-- ACTION BUTTONS -->
                    <div style="margin: 28px 0 24px 0;">
                      <a href="zeneva://support" style="background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 24px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 12px; margin-bottom: 12px;">
                        Open in App &rarr;
                      </a>
                      <a href="${baseUrl}/support" style="background-color: #f5f5f4; color: #44403c; border: 1px solid #d6d3d1; text-decoration: none; padding: 12px 30px; border-radius: 24px; font-weight: 700; font-size: 14px; display: inline-block; margin-bottom: 12px;">
                        View on Web
                      </a>
                    </div>

                    <p style="margin: 0 0 4px 0; font-size: 13px; color: #78716c;">
                      No pressure. We will be here whenever you need assistance.
                    </p>
                    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #ea580c;">
                      Support Team from Zeneva
                    </p>
                  </td>
                </tr>

                <!-- MINIMAL FOOTER (LOGIN / SIGNUP PAGE STYLE) -->
                <tr>
                  <td style="padding: 24px 40px 32px 40px; background-color: #ffffff; border-top: 1px solid #f5f5f4; text-align: center;">
                    
                    <!-- SOCIAL ICONS CENTERED -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom: 16px;">
                      <tr>
                        <td style="padding: 0 8px;">
                          <a href="https://x.com/zeneva_retail" target="_blank">
                            <img src="${xIcon}" width="18" height="18" alt="X" style="display: block; opacity: 0.6;" />
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://www.instagram.com/zeneva_pos/" target="_blank">
                            <img src="${igIcon}" width="18" height="18" alt="Instagram" style="display: block; opacity: 0.6;" />
                          </a>
                        </td>
                        <td style="padding: 0 8px;">
                          <a href="https://linkedin.com/company/zeneva" target="_blank">
                            <img src="${inIcon}" width="18" height="18" alt="LinkedIn" style="display: block; opacity: 0.6;" />
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- COPYRIGHT & LEGAL LINKS -->
                    <p style="margin: 0; font-family: 'DM Sans', sans-serif; font-size: 12px; color: #a8a29e; line-height: 1.5;">
                      &copy; 2026 Zeneva Inc. &bull; 
                      <a href="${baseUrl}/legal/terms-of-service" style="color: #78716c; text-decoration: none;">Terms of Service</a> &bull; 
                      <a href="${baseUrl}/legal/privacy-policy" style="color: #78716c; text-decoration: none;">Privacy Policy</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const trackId = await sendEmail({
      to,
      name: userName,
      subject: emailSubject,
      body: htmlContent,
      type: 'support_reply',
      wrap: false
    });

    return NextResponse.json({
      success: true,
      trackId,
      message: 'Support reply sent to user Gmail via Resend.'
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Send Support Reply Email Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to send email'
    }, { status: 500, headers: corsHeaders });
  }
}
