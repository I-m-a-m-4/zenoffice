import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/server/resend';

export async function POST(req: Request) {
  try {
    const { email, firstName, businessName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const name = firstName || email.split('@')[0];
    const bName = businessName || 'your business';

    const bodyHtml = `
      <h2 style="font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 16px; text-align: center;">
        Start with one product.
      </h2>
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://res.cloudinary.com/dd1czj85j/image/upload/v1789026565/zeneva/zeneva_email_3d_first_sale_1789026565531.jpg" alt="Welcome to Zeneva" width="280" height="280" style="display: block; border-radius: 24px; width: 100%; max-width: 280px; height: auto; margin: 0 auto;" />
      </div>
      <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px; text-align: center;">
        Hi ${name}, ${bName} is ready for your first catalog item. Add an item, snap a barcode, or record a quick sale in under 30 seconds.
      </p>
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://zeneva.space/dashboard" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold; display: inline-block;">
          Add your first product
        </a>
      </div>
    `;

    await sendEmail({
      to: email,
      name: name,
      subject: 'Welcome to Zeneva! Your store is ready.',
      body: bodyHtml,
      type: 'marketing',
      wrap: true
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send welcome email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
