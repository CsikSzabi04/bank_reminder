# Supabase Auth e-mail sablonok (generált — ne kézzel szerkeszd)

Generálás: `node scripts/build-email-templates.mjs`

**Beillesztés:** Dashboard → Authentication → Email Templates → a megfelelő sablon *Message body* mezőjébe a HTML; a *Subject* mezőbe az alábbi tárgy.

**Előfeltételek:** Authentication → URL Configuration → *Site URL* **záró perjel nélkül** (a linkek `{{ .SiteURL }}/auth/confirm?...` alakúak).
**Tárgy:** ha a Subject mező nem értelmezi a `{{ }}` sablont, használd a *fix kétnyelvű* tárgyat (és ellenőrizd tesztlevéllel, hogy nem látszik nyers `{{ ... }}`).

| Fájl | Dashboard-sablon | Fix tárgy (biztos) | Személyre szabott tárgy (ha támogatott) |
|---|---|---|---|
| confirm-signup.html | Confirm sign up | `Üdv a Bank Reminderben! Erősítsd meg az e-mailed · Confirm your email` | `{{ if eq .Data.locale "en" }}Welcome to Bank Reminder, {{ .Data.display_name }} — confirm your email{{ else }}Üdv a Bank Reminderben, {{ .Data.display_name }}! Erősítsd meg az e-mail címed{{ end }}` |
| recovery.html | Reset password | `Jelszó-visszaállítás · Reset your password` | `{{ if eq .Data.locale "en" }}Reset your Bank Reminder password{{ else }}Jelszó-visszaállítás — Bank Reminder{{ end }}` |
| email-change.html | Change email address | `E-mail cím módosítása · Confirm your new email` | — |
| reauthentication.html | Reauthentication | `Megerősítő kód · Your verification code` | — |
| magic-link.html | Magic link | `Belépés · Sign in` | — |
| invite.html | Invite user | `Meghívó · You're invited` | — |
| password-changed.html | Security: Password changed | `A jelszavad megváltozott · Your password was changed` | — |
| email-changed.html | Security: Email address changed | `Az e-mail címed megváltozott · Your email was changed` | — |
