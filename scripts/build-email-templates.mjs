#!/usr/bin/env node
// A-05: Supabase Auth e-mail sablonok generálása (HU/EN, személyre szabott). Kimenet: supabase/email-templates/
// Futtatás: node scripts/build-email-templates.mjs   — a HTML-eket a Dashboard → Authentication → Email Templates alá kell másolni.
import { mkdirSync, writeFileSync } from 'node:fs';

const BRAND = '#0B7F70';
const FONT = 'Inter,Segoe UI,Arial,sans-serif';
const t = (hu, en) => `{{ if eq .Data.locale "en" }}${en}{{ else }}${hu}{{ end }}`;
const hi = (hu, en) => t(`${hu}{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}!`, `${en}{{ if .Data.display_name }} {{ .Data.display_name }}{{ end }}!`);
const link = (type, next) => `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;

const p = (html, color = '#334155', size = 16, mb = 16) =>
  `<p style="margin:0 0 ${mb}px 0;font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
const button = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:${BRAND};color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:12px;">${label}</a>`;
const fallback = (href) =>
  p(`${t('Nem működik a gomb? Másold be ezt a linket a böngészőbe:', 'Button not working? Copy this link into your browser:')}<br><a href="${href}" style="color:${BRAND};word-break:break-all;">${href.replace(/&/g, '&amp;')}</a>`, '#64748B', 13, 8);
const notBank = p(t('A Bank Reminder nem bank, és soha nem kér tőled banki jelszót.', 'Bank Reminder is not a bank and never asks for your banking passwords.'), '#64748B', 13, 0);

function layout({ preheader, heading, body, cta, foot }) {
  return `<!doctype html>
<html lang="hu">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>Bank Reminder</title></head>
<body style="margin:0;padding:0;background:#F4F6F8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;border:1px solid #E7EAEE;overflow:hidden;">
<tr><td style="padding:28px 32px 0 32px;font-family:${FONT};"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;background:${BRAND};border-radius:10px;text-align:center;font-size:20px;line-height:36px;color:#FFFFFF;">&#128276;</td>
<td style="padding-left:10px;font-size:18px;font-weight:700;color:#0F1720;">Bank Reminder</td></tr></table></td></tr>
<tr><td style="padding:24px 32px 8px 32px;font-family:${FONT};color:#0F1720;"><h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;">${heading}</h1>${body}</td></tr>
${cta ? `<tr><td align="left" style="padding:8px 32px;font-family:${FONT};">${cta}</td></tr>` : ''}
<tr><td style="padding:20px 32px 28px 32px;font-family:${FONT};">${foot}</td></tr>
</table>
<p style="margin:16px 0 0 0;font-family:${FONT};font-size:12px;color:#94A3B8;">${t('Ez egy automatikus üzenet — kérjük, ne válaszolj rá.', "This is an automated message — please don't reply.")}</p>
</td></tr></table>
</body>
</html>
`;
}

const confirmHref = link('signup', '/onboarding');
const recoveryHref = link('recovery', '/reset-password');
const emailChangeHref = link('email_change', '/profile');
const magicHref = link('magiclink', '/dashboard');
const inviteHref = link('invite', '/onboarding');

const templates = {
  'confirm-signup.html': {
    subject: ['Üdv a Bank Reminderben, {{ .Data.display_name }}! Erősítsd meg az e-mail címed', 'Welcome to Bank Reminder, {{ .Data.display_name }} — confirm your email'],
    fixedSubject: 'Üdv a Bank Reminderben! Erősítsd meg az e-mailed · Confirm your email',
    html: layout({
      preheader: t('Egy kattintás, és minden számlád egy helyen lesz.', 'One click and your bills are in one place.'),
      heading: `${hi('Szia', 'Hi')} &#128075;`,
      body:
        p(t('Köszönjük, hogy csatlakoztál a <strong>Bank Reminderhez</strong>. Egyetlen kattintással megerősítjük az e-mail címedet (<strong>{{ .Email }}</strong>), és már használhatod is.',
            'Thanks for joining <strong>Bank Reminder</strong>. Confirm your email address (<strong>{{ .Email }}</strong>) with one click and you\'re in.')) +
        p(`<strong style="color:#0F1720;">${t('Ezt fogod tudni:', "What you'll be able to do:")}</strong><br>` +
          t('&#128197; Egyszer felveszed a számláidat és előfizetéseidet — Netflix, rezsi, hitel, biztosítás.<br>&#128276; Időben szólunk — telefonon, tableten és számítógépen is.<br>&#128202; Látod, hová megy a pénzed, és hol spórolhatsz.',
            '&#128197; Add every bill and subscription once — Netflix, rent, loans, insurance.<br>&#128276; Get a reminder in time — on your phone, tablet and computer.<br>&#128202; See where your money goes and where you could save.'), '#334155', 15, 8),
      cta: button(confirmHref, t('Fiók megerősítése', 'Confirm my account')),
      foot: fallback(confirmHref) +
        p(t('A link 1 óráig érvényes. Nem te regisztráltál? Hagyd figyelmen kívül ezt a levelet — a fiók nem lesz aktiválva.', "The link is valid for 1 hour. Didn't sign up? Just ignore this email — the account won't be activated."), '#64748B', 13, 8) + notBank,
    }),
  },
  'recovery.html': {
    subject: ['Jelszó-visszaállítás — Bank Reminder', 'Reset your Bank Reminder password'],
    fixedSubject: 'Jelszó-visszaállítás · Reset your password',
    html: layout({
      preheader: t('Állíts be új jelszót a fiókodhoz.', 'Choose a new password for your account.'),
      heading: hi('Szia', 'Hi'),
      body: p(t('Jelszó-visszaállítást kértek a(z) <strong>{{ .Email }}</strong> fiókhoz. Kattints a gombra, és adj meg egy új jelszót.',
                'We got a request to reset the password for <strong>{{ .Email }}</strong>. Click the button to choose a new one.')),
      cta: button(recoveryHref, t('Új jelszó beállítása', 'Set a new password')),
      foot: fallback(recoveryHref) +
        p(t('A link 1 óráig érvényes. <strong>Nem te kérted?</strong> Ne aggódj, a jelszavad nem változott — hagyd figyelmen kívül a levelet.',
            "The link is valid for 1 hour. <strong>Didn't ask for this?</strong> Your password hasn't changed — just ignore this email."), '#64748B', 13, 8) + notBank,
    }),
  },
  'email-change.html': {
    subject: null, fixedSubject: 'E-mail cím módosítása · Confirm your new email',
    html: layout({
      preheader: t('Erősítsd meg az új e-mail címedet.', 'Confirm your new email address.'),
      heading: t('E-mail cím módosítása', 'Change your email'),
      body: p(t('Megerősítenéd az új e-mail címedet (<strong>{{ .NewEmail }}</strong>)?', 'Would you like to confirm your new email address (<strong>{{ .NewEmail }}</strong>)?')),
      cta: button(emailChangeHref, t('E-mail módosítása', 'Confirm new email')),
      foot: fallback(emailChangeHref) + p(t('Nem te kérted? Azonnal változtasd meg a jelszavad.', "Didn't ask for this? Change your password right away."), '#64748B', 13, 8) + notBank,
    }),
  },
  'reauthentication.html': {
    subject: null, fixedSubject: 'Megerősítő kód · Your verification code',
    html: layout({
      preheader: t('A megerősítő kódod.', 'Your verification code.'),
      heading: t('Megerősítő kód', 'Verification code'),
      body: p(t('A művelet megerősítéséhez add meg ezt a kódot:', 'Enter this code to confirm the action:')) +
        `<p style="margin:0 0 16px 0;font-size:32px;letter-spacing:6px;font-weight:700;color:#0F1720;">{{ .Token }}</p>`,
      cta: '',
      foot: p(t('A kód rövid ideig érvényes. Nem te kérted? Hagyd figyelmen kívül ezt a levelet.', "The code is valid for a short time. Didn't ask for this? Just ignore this email."), '#64748B', 13, 8) + notBank,
    }),
  },
  'magic-link.html': {
    subject: null, fixedSubject: 'Belépés · Sign in',
    html: layout({
      preheader: t('Belépési link.', 'Your sign-in link.'),
      heading: hi('Szia', 'Hi'),
      body: p(t('Kattints a gombra a belépéshez.', 'Click the button to sign in.')),
      cta: button(magicHref, t('Belépés', 'Sign in')),
      foot: fallback(magicHref) + notBank,
    }),
  },
  'invite.html': {
    subject: null, fixedSubject: 'Meghívó · You\'re invited',
    html: layout({
      preheader: t('Meghívtak a Bank Reminderbe.', "You've been invited to Bank Reminder."),
      heading: t('Meghívót kaptál', "You're invited"),
      body: p(t('Meghívtak a Bank Reminderbe. Kattints a gombra a fiókod létrehozásához.', "You've been invited to Bank Reminder. Click the button to set up your account.")),
      cta: button(inviteHref, t('Meghívó elfogadása', 'Accept invite')),
      foot: fallback(inviteHref) + notBank,
    }),
  },
  'password-changed.html': {
    subject: null, fixedSubject: 'A jelszavad megváltozott · Your password was changed',
    html: layout({
      preheader: t('A jelszavad megváltozott.', 'Your password was changed.'),
      heading: t('A jelszavad megváltozott', 'Your password was changed'),
      body: p(t('A(z) <strong>{{ .Email }}</strong> fiók jelszava megváltozott. Ha nem te voltál, <strong>azonnal</strong> állítsd vissza.',
                'The password for <strong>{{ .Email }}</strong> was changed. If this wasn\'t you, reset it <strong>right away</strong>.')),
      cta: button('{{ .SiteURL }}/forgot-password', t('Jelszó visszaállítása', 'Reset password')),
      foot: notBank,
    }),
  },
  'email-changed.html': {
    subject: null, fixedSubject: 'Az e-mail címed megváltozott · Your email was changed',
    html: layout({
      preheader: t('Az e-mail címed megváltozott.', 'Your email address was changed.'),
      heading: t('Az e-mail címed megváltozott', 'Your email address was changed'),
      body: p(t('Az e-mail címed megváltozott: <strong>{{ .OldEmail }}</strong> → <strong>{{ .Email }}</strong>. Ha nem te voltál, azonnal változtass jelszót.',
                'Your email address changed: <strong>{{ .OldEmail }}</strong> → <strong>{{ .Email }}</strong>. If this wasn\'t you, change your password right away.')),
      cta: '', foot: notBank,
    }),
  },
};

const dir = 'supabase/email-templates';
mkdirSync(dir, { recursive: true });
let readme = `# Supabase Auth e-mail sablonok (generált — ne kézzel szerkeszd)\n\nGenerálás: \`node scripts/build-email-templates.mjs\`\n\n` +
  `**Beillesztés:** Dashboard → Authentication → Email Templates → a megfelelő sablon *Message body* mezőjébe a HTML; a *Subject* mezőbe az alábbi tárgy.\n\n` +
  `**Előfeltételek:** Authentication → URL Configuration → *Site URL* **záró perjel nélkül** (a linkek \`{{ .SiteURL }}/auth/confirm?...\` alakúak).\n` +
  `**Tárgy:** ha a Subject mező nem értelmezi a \`{{ }}\` sablont, használd a *fix kétnyelvű* tárgyat (és ellenőrizd tesztlevéllel, hogy nem látszik nyers \`{{ ... }}\`).\n\n` +
  `| Fájl | Dashboard-sablon | Fix tárgy (biztos) | Személyre szabott tárgy (ha támogatott) |\n|---|---|---|---|\n`;
const names = { 'confirm-signup.html': 'Confirm sign up', 'recovery.html': 'Reset password', 'email-change.html': 'Change email address', 'reauthentication.html': 'Reauthentication',
  'magic-link.html': 'Magic link', 'invite.html': 'Invite user', 'password-changed.html': 'Security: Password changed', 'email-changed.html': 'Security: Email address changed' };
for (const [file, tpl] of Object.entries(templates)) {
  writeFileSync(`${dir}/${file}`, tpl.html);
  const pers = tpl.subject ? `\`{{ if eq .Data.locale "en" }}${tpl.subject[1]}{{ else }}${tpl.subject[0]}{{ end }}\`` : '—';
  readme += `| ${file} | ${names[file]} | \`${tpl.fixedSubject}\` | ${pers} |\n`;
}
writeFileSync(`${dir}/README.md`, readme);
console.log(`✔ ${Object.keys(templates).length} sablon → ${dir}/`);
