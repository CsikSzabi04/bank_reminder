#!/usr/bin/env node
// VAPID kulcspár (P-256, base64url) — Web Crypto/Node crypto, nincs külső függőség. A privát kulcsot NEM írja fájlba.
// Önállóan futtatva csak a PUBLIKUS kulcsot írja ki; a pár beállítását a scripts/setup-secrets.mjs végzi.
import { generateKeyPairSync } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function generateVapid() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const prv = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([0x04]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);   // 65 bájt, tömörítetlen
  return { publicKey: b64u(raw), privateKey: prv.d };                                                                   // d: 32 bájt base64url
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { publicKey } = generateVapid();
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
  console.error('(csak a publikus kulcs került kiírásra; a páros beállításához használd: node scripts/setup-secrets.mjs)');
}
