/**
 * Optics by Ivors — Editorial Light Cream Design System for Emails.
 * 
 * Aesthetic: Light luxury cream palette matching frontend design:
 * - Outer background: #F7F5F0 (warm cream / alabaster)
 * - Container card: #FFFFFF with subtle border #EAE4DC and soft shadow
 * - Primary text: #1C1917 (warm deep obsidian)
 * - Secondary text: #59554F (refined mocha charcoal)
 * - Accent/Pill: #F2ECE4 background with #3D3935 text & #DDD5C8 border
 * - Buttons: #1C1917 (solid obsidian) with #FDFBF7 text
 * - Zero emojis — strictly minimal geometric SVG icons & typography.
 */

interface BaseTemplateOptions {
  title: string;
  previewText?: string;
  badgeText?: string;
  badgeIcon?: string;
  bodyContent: string;
}

// Minimal inline SVG icons styled in warm neutral palette
const icons = {
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#59554F" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  key: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#59554F" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M16 7l-2 2m-4-2a6 6 0 1 0-8.5 8.5 6 6 0 0 0 8.5-8.5z"/></svg>`,
  lock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A746C" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  compass: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#59554F" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  layers: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#66615A" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#59554F" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  fileText: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#66615A" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  checkCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  alertCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

/**
 * Editorial Base Layout — Light Cream Luxury Aesthetic
 */
const baseEmailLayout = ({ title, previewText, badgeText, badgeIcon, bodyContent }: BaseTemplateOptions): string => {
  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F7F5F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #1C1917;
    }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #F7F5F0;
      padding: 44px 16px;
    }
    .main {
      background-color: #FFFFFF;
      margin: 0 auto;
      width: 100%;
      max-width: 540px;
      border: 1px solid #EAE4DC;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(60, 50, 40, 0.04);
    }
    .header {
      padding: 28px 36px 20px 36px;
      background-color: #FFFFFF;
      border-bottom: 1px solid #F0EAE1;
    }
    .brand-table {
      width: 100%;
    }
    .brand-name {
      font-size: 16px;
      font-weight: 700;
      color: #1C1917;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      color: #8C857B;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 2px;
    }
    .content {
      padding: 36px 36px 32px 36px;
      background-color: #FFFFFF;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 11px;
      background-color: #F4EFEB;
      border: 1px solid #E3DCD1;
      border-radius: 6px;
      font-size: 11.5px;
      letter-spacing: 0.04em;
      color: #4A4640;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .h1-title {
      margin: 0 0 14px 0;
      color: #1C1917;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }
    .body-p {
      margin: 0 0 24px 0;
      font-size: 14.5px;
      line-height: 1.65;
      color: #59554F;
    }
    .footer {
      padding: 24px 36px;
      background-color: #FAF8F5;
      border-top: 1px solid #EFEAE1;
      text-align: center;
      color: #8C857B;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer a {
      color: #59554F;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;font-size:1px;color:#F7F5F0;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <div class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <table class="brand-table" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                      <table cellpadding="0" cellspacing="0" style="background-color: #1C1917; border-radius: 7px; width: 28px; height: 28px; text-align: center;">
                        <tr>
                          <td align="center" style="vertical-align: middle; color: #FAF7F2; font-size: 12px; font-weight: 800; letter-spacing: -0.03em; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">OP</td>
                        </tr>
                      </table>
                    </td>
                    <td style="vertical-align: middle;">
                      <div class="brand-name">Optics</div>
                      <div class="brand-sub">Ivors Platform</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" style="vertical-align: middle;">
                <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: #D6CEC2;"></span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="content">
          ${badgeText ? `
            <div style="margin-bottom: 18px;">
              <table cellpadding="0" cellspacing="0" style="background-color: #F4EFEB; border: 1px solid #E3DCD1; border-radius: 6px;">
                <tr>
                  <td style="padding: 5px 10px; font-size: 11.5px; font-weight: 600; color: #4A4640; letter-spacing: 0.04em;">
                    ${badgeIcon ? `${badgeIcon}&nbsp;&nbsp;` : ''}${badgeText}
                  </td>
                </tr>
              </table>
            </div>
          ` : ''}
          ${bodyContent}
        </td>
      </tr>
      <tr>
        <td class="footer">
          Confidential automated message from Optics by Ivors.<br>
          © ${new Date().getFullYear()} Ivors Engineering Systems. All rights reserved. &bull; <a href="https://ivors.in">ivors.in</a>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
};

/**
 * 1. OTP Verification Email (Registration, Login 2nd Method, Password Reset)
 * Light Creamy Editorial Design. Zero Emojis. Clean Typography.
 */
export const renderOtpEmail = (params: {
  code: string;
  purpose: 'REGISTER' | 'LOGIN' | 'PASSWORD_RESET';
  name?: string;
  expiryMinutes?: number;
}): { html: string; subject: string; text: string } => {
  const { code, purpose, name = 'there', expiryMinutes = 10 } = params;

  let actionTitle = 'Sign-in Verification Code';
  let actionDesc = 'Enter the one-time authentication code below to securely access your Optics workspace.';
  let badgeLabel = 'Authentication';
  let badgeIcon = icons.key;

  if (purpose === 'REGISTER') {
    actionTitle = 'Confirm Your Email Address';
    actionDesc = 'Welcome to Optics! Please confirm your email address using the one-time verification code below.';
    badgeLabel = 'Account Verification';
    badgeIcon = icons.shield;
  } else if (purpose === 'PASSWORD_RESET') {
    actionTitle = 'Reset Account Password';
    actionDesc = 'A password reset was requested for your Optics account. Use the code below to authorize choosing a new password.';
    badgeLabel = 'Password Reset';
    badgeIcon = icons.lock;
  }

  const subject = `${code} is your Optics verification code`;

  const bodyContent = `
    <h1 class="h1-title">${actionTitle}</h1>
    <p class="body-p">
      Hello ${name},<br>
      ${actionDesc}
    </p>

    <!-- Cream Monospace OTP Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0 28px 0; background-color: #FAF7F2; border: 1px solid #EAE3D8; border-radius: 10px; text-align: center;">
      <tr>
        <td style="padding: 26px 20px;">
          <div style="font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 9px; color: #1C1917; line-height: 1;">
            ${code}
          </div>
          <div style="font-size: 12px; color: #8C857B; margin-top: 10px; font-weight: 500;">
            This code expires in ${expiryMinutes} minutes
          </div>
        </td>
      </tr>
    </table>

    <!-- Subtle Security Callout -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDFBF8; border: 1px solid #F0EAE1; border-radius: 8px; margin-bottom: 8px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 12.5px; color: #7A746C; line-height: 1.55;">
          <strong style="color: #4A4640;">Security Notice:</strong> Never share this code with anyone. Optics engineers will never ask for your verification code. If you did not make this request, you can safely disregard this email.
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    title: actionTitle,
    previewText: `${code} is your verification code for Optics.`,
    badgeText: badgeLabel,
    badgeIcon,
    bodyContent,
  });

  const text = `${actionTitle}\n\nHello ${name},\n${actionDesc}\n\nYour Verification Code: ${code}\n(Expires in ${expiryMinutes} minutes)\n\nOptics by Ivors`;

  return { html, subject, text };
};

/**
 * 2. Welcome Onboarding Email (Post-registration workspace provisioning)
 * Light Creamy Editorial Design. Zero Emojis. Clean Typography.
 */
export const renderWelcomeEmail = (params: {
  name: string;
  email: string;
  orgName?: string;
  loginUrl?: string;
}): { html: string; subject: string; text: string } => {
  const { name, orgName = 'Your Team Workspace', loginUrl = 'http://localhost:3000' } = params;

  const subject = `Welcome to Optics &bull; ${orgName}`;

  const bodyContent = `
    <h1 class="h1-title">Welcome to Optics, ${name}</h1>
    <p class="body-p">
      Your workspace <strong>${orgName}</strong> is provisioned and ready for your team. Optics delivers board-driven issue tracking, collaborative documentation, and real-time sprint execution.
    </p>

    <!-- Structured Light Cream Steps Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF7F2; border: 1px solid #EAE3D8; border-radius: 10px; margin-bottom: 28px;">
      <tr>
        <td style="padding: 22px 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #8C857B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px;">
            Recommended next steps
          </div>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; vertical-align: top; width: 26px;">${icons.layers}</td>
              <td style="padding: 8px 0; font-size: 13.5px; color: #59554F; line-height: 1.5;">
                <strong style="color: #1C1917;">Create Projects & Boards:</strong> Configure columns, WIP limits, and custom workflows.
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; vertical-align: top; width: 26px;">${icons.users}</td>
              <td style="padding: 8px 0; font-size: 13.5px; color: #59554F; line-height: 1.5;">
                <strong style="color: #1C1917;">Invite Team Members:</strong> Assign granular RBAC roles from Developer to Workspace Admin.
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; vertical-align: top; width: 26px;">${icons.fileText}</td>
              <td style="padding: 8px 0; font-size: 13.5px; color: #59554F; line-height: 1.5;">
                <strong style="color: #1C1917;">Author Technical Specs:</strong> Compose collaborative markdown documentation linked to tasks.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Obsidian Primary Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="background-color: #1C1917; border-radius: 8px; text-align: center;">
          <a href="${loginUrl}" style="display: inline-block; padding: 13px 26px; color: #FAF7F2; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: -0.01em;">
            Open Optics Workspace &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 12.5px; color: #8C857B; line-height: 1.5;">
      Need assistance? Contact our engineering team at <a href="mailto:support@ivors.in" style="color: #59554F;">support@ivors.in</a>.
    </p>
  `;

  const html = baseEmailLayout({
    title: 'Welcome to Optics',
    previewText: `Your workspace ${orgName} has been initialized.`,
    badgeText: 'Workspace Provisioned',
    badgeIcon: icons.compass,
    bodyContent,
  });

  const text = `Welcome to Optics, ${name}.\n\nYour workspace "${orgName}" is ready.\nOpen your workspace: ${loginUrl}\n\nIvors Engineering Systems`;

  return { html, subject, text };
};

/**
 * 3. Team Member Invitation Email
 * Light Creamy Editorial Design. Zero Emojis. Clean Typography.
 */
export const renderTeamInviteEmail = (params: {
  to: string;
  name?: string;
  inviterName?: string;
  orgName?: string;
  role?: string;
  teamName?: string;
  temporaryPassword?: string;
  inviteUrl?: string;
  loginUrl?: string;
  expiresDays?: number;
}): { html: string; subject: string; text: string } => {
  const {
    name,
    inviterName = 'Your team lead',
    orgName = 'Optics Workspace',
    role = 'Developer',
    teamName,
    temporaryPassword,
    inviteUrl,
    loginUrl = 'http://localhost:3000',
    expiresDays = 7,
  } = params;

  const targetUrl = inviteUrl || loginUrl;
  const subject = `Invitation &bull; Join ${orgName} on Optics`;

  const bodyContent = `
    <h1 class="h1-title">Invitation to join ${orgName}</h1>
    <p class="body-p">
      Hello${name ? ` ${name}` : ''},<br>
      <strong>${inviterName}</strong> has invited you to collaborate on <strong>${orgName}</strong> as a <strong>${role}</strong>${teamName ? ` in the <em>${teamName}</em> team` : ''}.
    </p>

    <!-- Invitation Summary Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF7F2; border: 1px solid #EAE3D8; border-radius: 10px; margin-bottom: 28px;">
      <tr>
        <td style="padding: 20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13.5px;">
            <tr>
              <td style="padding: 6px 0; color: #8C857B; width: 130px;">Organization</td>
              <td style="padding: 6px 0; color: #1C1917; font-weight: 600;">${orgName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Invited By</td>
              <td style="padding: 6px 0; color: #3D3935; font-weight: 500;">${inviterName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Role</td>
              <td style="padding: 6px 0; color: #3D3935; font-weight: 500;">${role}</td>
            </tr>
            ${temporaryPassword ? `
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Temp Password</td>
              <td style="padding: 6px 0; font-family: monospace; color: #1C1917; font-weight: 700;">${temporaryPassword}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Link Validity</td>
              <td style="padding: 6px 0; color: #8C857B;">${expiresDays} days</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Obsidian Primary Button -->
    <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="background-color: #1C1917; border-radius: 8px; text-align: center;">
          <a href="${targetUrl}" style="display: inline-block; padding: 13px 26px; color: #FAF7F2; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: -0.01em;">
            Accept Invitation &amp; Sign In &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 12px; color: #8C857B; line-height: 1.5;">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
  `;

  const html = baseEmailLayout({
    title: 'Workspace Invitation',
    previewText: `${inviterName} invited you to join ${orgName} on Optics.`,
    badgeText: 'Team Invitation',
    badgeIcon: icons.users,
    bodyContent,
  });

  const text = `You're invited to join ${orgName} on Optics\n\nHello${name ? ` ${name}` : ''},\n${inviterName} has invited you to join ${orgName} as a ${role}.\n\nAccept your invitation: ${targetUrl}\n${temporaryPassword ? `Temporary Password: ${temporaryPassword}\n` : ''}\nThis invitation link expires in ${expiresDays} days.`;

  return { html, subject, text };
};

/**
 * 4. Security Alert Email (Password Reset, Credentials Updated)
 * Light Creamy Editorial Design. Zero Emojis. Clean Typography.
 */
export const renderSecurityAlertEmail = (params: {
  name?: string;
  to?: string;
  action: string;
  timestamp?: string;
  ipAddress?: string;
  device?: string;
}): { html: string; subject: string; text: string } => {
  const {
    name = 'there',
    to,
    action,
    timestamp = new Date().toUTCString(),
    ipAddress = 'Unknown',
    device = 'Web Client',
  } = params;

  const subject = `Security Notice &bull; ${action}`;

  const bodyContent = `
    <h1 class="h1-title">Account Security Notice</h1>
    <p class="body-p">
      Hello ${name},<br>
      A security event was recorded for your Optics account${to ? ` (<strong>${to}</strong>)` : ''}:
    </p>

    <!-- Activity Metadata Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF7F2; border: 1px solid #EAE3D8; border-radius: 10px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13.5px;">
            <tr>
              <td style="padding: 6px 0; color: #8C857B; width: 120px;">Event</td>
              <td style="padding: 6px 0; color: #1C1917; font-weight: 600;">${action}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Timestamp</td>
              <td style="padding: 6px 0; color: #3D3935;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">Device / Client</td>
              <td style="padding: 6px 0; color: #3D3935;">${device}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #8C857B;">IP Address</td>
              <td style="padding: 6px 0; color: #3D3935;">${ipAddress}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDFBF8; border: 1px solid #F0EAE1; border-radius: 8px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 12.5px; color: #7A746C; line-height: 1.55;">
          If you performed this action, no further steps are needed. If you did not authorize this change, please reset your password immediately or reach out to <a href="mailto:support@ivors.in" style="color: #4A4640; font-weight: 600;">support@ivors.in</a>.
        </td>
      </tr>
    </table>
  `;

  const html = baseEmailLayout({
    title: 'Security Notice',
    previewText: `Security Notice: ${action}`,
    badgeText: 'Security Notice',
    badgeIcon: icons.shield,
    bodyContent,
  });

  const text = `Security Notice: ${action}\n\nHello ${name},\nYour Optics account recorded a security event: ${action} at ${timestamp}.\nDevice: ${device}\nIP: ${ipAddress}\n\nIf you did not make this change, please contact support@ivors.in immediately.`;

  return { html, subject, text };
};
