import { assertEquals } from 'jsr:@std/assert@1';
import { merchantKey, normalizeMerchantKey } from './merchant.ts';

// Ugyanezeket a vektorokat teljesíti a B-oldali normalizáló is (tests/unit/bank-rules.test.ts) — a két oldal kulcsa nem térhet el
const vectors: [string, string][] = [
  ['Tesco Expressz', 'tesco expressz'],
  ['Árvíztűrő Tükörfúrógép', 'arvizturo tukorfurogep'],
  ["McDonald's Budapest*123", 'mcdonald s budapest 123'],
  ['  OTP   Bank  ', 'otp bank'],
  ['Café-Étterem', 'cafe etterem'],
  ['ŐŰ őű', 'ou ou'],
  ['Spar #0042', 'spar 0042'],
  ['!!!', ''],
];

Deno.test('normalizeMerchantKey: a B-oldali közös vektorok', () => {
  for (const [input, expected] of vectors) assertEquals(normalizeMerchantKey(input), expected, input);
});

Deno.test('normalizeMerchantKey: idempotens', () => {
  for (const [, key] of vectors) assertEquals(normalizeMerchantKey(key), key);
});

Deno.test('merchantKey: ≥ 2 karakter kell, legfeljebb 60 (a szabály-kulcs korlátja), nincs záró szóköz', () => {
  assertEquals(merchantKey('Tesco Expressz'), 'tesco expressz');
  assertEquals(merchantKey(null), null);
  assertEquals(merchantKey(undefined), null);
  assertEquals(merchantKey(''), null);
  assertEquals(merchantKey('!!!'), null);
  assertEquals(merchantKey('X'), null, '1 karakteres kulcs nem szabály-alap');
  assertEquals(merchantKey('Xy'), 'xy');
  const long = merchantKey('abcdefghij '.repeat(10))!;
  assertEquals(long.length <= 60, true);
  assertEquals(long, long.trim());
  assertEquals(merchantKey('a'.repeat(59) + ' bbbb'), 'a'.repeat(59), 'a 60. karakternél csonkolt szóköz levágva');
});
