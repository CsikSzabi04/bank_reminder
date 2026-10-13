-- A-08: rendszer-kategóriák (ARCHITECTURE.md Függelék C) + induló szolgáltatás-katalógus.
-- Referencia-adat migrációként (idempotens upsert), mert nincs helyi `db reset` / seed-futtatás.
-- Katalógus: CSAK név, kategória, átfedés-csoport, hivatalos weboldal (HTTP-ellenőrizve 2026-10-13).
-- Ár, csomag, tartalom-címke szándékosan NINCS (H7: nincs ellenőrzött forrás) → a tippek ezeken nem alapulnak.

insert into public.categories (key, name_hu, name_en, icon, color_slot, kind, sort) values
  ('streaming',     'Streaming',                    'Streaming',            'tv',              1, 'bill',    10),
  ('music',         'Zene',                         'Music',                'music',           1, 'bill',    11),
  ('software',      'Szoftver és felhő',            'Software & cloud',     'cloud',           1, 'bill',    12),
  ('gaming',        'Játék',                        'Gaming',               'gamepad-2',       1, 'bill',    13),
  ('rent',          'Lakbér',                       'Rent',                 'home',            2, 'bill',    20),
  ('utilities',     'Rezsi',                        'Utilities',            'zap',             2, 'bill',    21),
  ('maintenance',   'Közös költség, karbantartás',  'Maintenance fees',     'wrench',          2, 'both',    22),
  ('mobile',        'Mobiltelefon',                 'Mobile',               'smartphone',      3, 'bill',    30),
  ('internet',      'Internet és TV',               'Internet & TV',        'wifi',            3, 'bill',    31),
  ('insurance',     'Biztosítás',                   'Insurance',            'shield-check',    4, 'bill',    40),
  ('taxes',         'Adó',                          'Taxes',                'landmark',        4, 'bill',    41),
  ('loans',         'Hitel, törlesztés',            'Loans',                'banknote',        5, 'bill',    50),
  ('bank_fees',     'Bankköltség',                  'Bank fees',            'credit-card',     5, 'bill',    51),
  ('groceries',     'Élelmiszer',                   'Groceries',            'shopping-basket', 6, 'both',    60),
  ('household',     'Háztartás, drogéria',          'Household',            'spray-can',       6, 'both',    61),
  ('transport',     'Közlekedés',                   'Transport',            'bus',             6, 'both',    62),
  ('eating_out',    'Étterem',                      'Eating out',           'utensils',        7, 'expense', 70),
  ('shopping',      'Vásárlás, ruházat',            'Shopping & clothing',  'shopping-bag',    7, 'expense', 71),
  ('fun',           'Szórakozás',                   'Fun money',            'party-popper',    7, 'expense', 72),
  ('sports',        'Sport, fitness',               'Sports & fitness',     'dumbbell',        7, 'both',    73),
  ('personal_care', 'Szépségápolás',                'Personal care',        'sparkles',        7, 'expense', 74),
  ('health',        'Egészség',                     'Health',               'heart-pulse',     7, 'both',    75),
  ('education',     'Oktatás',                      'Education',            'graduation-cap',  7, 'both',    76),
  ('kids',          'Gyerek',                       'Kids',                 'baby',            7, 'both',    77),
  ('gifts',         'Ajándék, adomány',             'Gifts & donations',    'gift',            7, 'expense', 78),
  ('travel',        'Utazás',                       'Travel',               'plane',           7, 'both',    79),
  ('other',         'Egyéb',                        'Other',                'circle-ellipsis', 9, 'both',    99)
on conflict (key) where user_id is null do update set
  name_hu = excluded.name_hu, name_en = excluded.name_en, icon = excluded.icon,
  color_slot = excluded.color_slot, kind = excluded.kind, sort = excluded.sort;

insert into public.service_catalog (slug, name, category_key, group_key, website, source_url, verified_at) values
  ('netflix',          'Netflix',            'streaming', 'video_streaming', 'https://www.netflix.com',              'https://www.netflix.com',              date '2026-10-13'),
  ('hbo-max',          'HBO Max',            'streaming', 'video_streaming', 'https://www.hbomax.com',               'https://www.hbomax.com',               date '2026-10-13'),
  ('disney-plus',      'Disney+',            'streaming', 'video_streaming', 'https://www.disneyplus.com',           'https://www.disneyplus.com',           date '2026-10-13'),
  ('prime-video',      'Prime Video',        'streaming', 'video_streaming', 'https://www.primevideo.com',           'https://www.primevideo.com',           date '2026-10-13'),
  ('skyshowtime',      'SkyShowtime',        'streaming', 'video_streaming', 'https://www.skyshowtime.com',          'https://www.skyshowtime.com',          date '2026-10-13'),
  ('youtube-premium',  'YouTube Premium',    'streaming', 'video_streaming', 'https://www.youtube.com/premium',      'https://www.youtube.com/premium',      date '2026-10-13'),
  ('spotify',          'Spotify',            'music',     'music_streaming', 'https://www.spotify.com',              'https://www.spotify.com',              date '2026-10-13'),
  ('apple-music',      'Apple Music',        'music',     'music_streaming', 'https://music.apple.com',              'https://music.apple.com',              date '2026-10-13'),
  ('icloud',           'iCloud+',            'software',  'cloud_storage',   'https://www.apple.com/icloud',         'https://www.apple.com/icloud',         date '2026-10-13'),
  ('google-one',       'Google One',         'software',  'cloud_storage',   'https://one.google.com',               'https://one.google.com',               date '2026-10-13'),
  ('dropbox',          'Dropbox',            'software',  'cloud_storage',   'https://www.dropbox.com',              'https://www.dropbox.com',              date '2026-10-13'),
  ('microsoft-365',    'Microsoft 365',      'software',  null,              'https://www.microsoft.com/microsoft-365', 'https://www.microsoft.com/microsoft-365', date '2026-10-13'),
  ('playstation-plus', 'PlayStation Plus',   'gaming',    'game_subscription','https://www.playstation.com/ps-plus', 'https://www.playstation.com/ps-plus',  date '2026-10-13'),
  ('xbox-game-pass',   'Xbox Game Pass',     'gaming',    'game_subscription','https://www.xbox.com/xbox-game-pass', 'https://www.xbox.com/xbox-game-pass',  date '2026-10-13'),
  ('magyar-telekom',   'Magyar Telekom',     'mobile',    'telecom',         'https://www.telekom.hu',               'https://www.telekom.hu',               date '2026-10-13'),
  ('yettel',           'Yettel',             'mobile',    'telecom',         'https://www.yettel.hu',                'https://www.yettel.hu',                date '2026-10-13'),
  ('one',              'One Magyarország',   'mobile',    'telecom',         'https://www.one.hu',                   'https://www.one.hu',                   date '2026-10-13'),
  ('digi',             'Digi',               'internet',  'telecom',         'https://digi.hu',                      'https://digi.hu',                      date '2026-10-13')
on conflict (slug) do update set
  name = excluded.name, category_key = excluded.category_key, group_key = excluded.group_key,
  website = excluded.website, source_url = excluded.source_url, verified_at = excluded.verified_at;
