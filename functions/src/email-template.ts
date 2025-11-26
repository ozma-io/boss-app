/**
 * Email HTML Template
 * 
 * Generates HTML email from title and body HTML.
 * Optimized for email clients with inline styles.
 */

/**
 * Render email HTML template
 */
export function renderEmailTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAF8F0;">
    <!-- Email Container -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FAF8F0;">
        <tr>
            <td style="padding: 40px 20px;">
                <!-- Main Content Card -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 32px 32px 32px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                            <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #000000; line-height: 1.3; font-family: 'Manrope', sans-serif;">
                                ${escapeHtml(title)}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px; color: #666666; font-size: 16px; line-height: 1.6; font-family: 'Manrope', sans-serif;">
                            ${bodyHtml}
                        </td>
                    </tr>
                    
                    <!-- App Download CTA -->
                    <tr>
                        <td style="padding: 24px 32px; background-color: #B6D95C; border-top: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #000000; font-family: 'Manrope', sans-serif;">
                                            💬 Get More from BossUp
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 14px; color: #333333; line-height: 1.5; font-family: 'Manrope', sans-serif;">
                                            Download the BossUp app to communicate with your AI assistant directly and get instant answers to your career questions — no need to wait for emails!
                                        </p>
                                        <a href="https://discovery.ozma.io/go-app/the-boss" style="display: inline-block; padding: 12px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; font-family: 'Manrope', sans-serif;">
                                            Download App
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px; border-top: 1px solid #f0f0f0; text-align: center;">
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666; font-family: 'Manrope', sans-serif;">
                                Best regards,
                            </p>
                            <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #000000; font-family: 'Manrope', sans-serif;">
                                BossUp
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5; font-family: 'Manrope', sans-serif;">
                                You're receiving this email because you signed up for BossUp career coaching.
                            </p>
                        </td>
                    </tr>
                </table>
                
                <!-- Unsubscribe Footer -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 20px auto 0;">
                    <tr>
                        <td style="text-align: center; padding: 0 20px;">
                            <p style="margin: 0; font-size: 12px; color: #999999; line-height: 1.5; font-family: 'Manrope', sans-serif;">
                                <a href="%unsubscribe_url%" style="color: #666666; text-decoration: underline;">Unsubscribe</a>
                                &nbsp;•&nbsp;
                                <a href="mailto:support@ozma.io" style="color: #666666; text-decoration: underline;">Contact Support</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

