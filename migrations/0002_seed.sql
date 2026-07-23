-- Majestic Roobee — seed data (catalogue, stores, demo orders & CRM history)

INSERT INTO locations (id, city, store, address, ship_ngn, ship_usd, eta, phone, sort) VALUES
  ('abuja',  'Abuja',  'Life Camp Store', 'Shop 3, Earthpoint Estate, Life Camp, FCT', 2500, 4, '1–2 days', '+234 906 227 7470', 1),
  ('lagos',  'Lagos',  'Lekki Store',     'Admiralty Way, Lekki Phase 1, Lagos',       3000, 5, '1–2 days', '+234 810 448 2210', 2),
  ('ibadan', 'Ibadan', 'Bodija Store',    'Awolowo Avenue, Bodija, Ibadan',            3500, 5, '2–3 days', '+234 703 990 5514', 3);

INSERT INTO categories (id, label, sort) VALUES
  ('extrait',  'Extrait Perfumes',    1),
  ('designer', 'Designer Fragrances', 2),
  ('sensual',  'Sensual Fragrances',  3),
  ('mist',     'Body Mists',          4),
  ('deo',      'Deodorants',          5),
  ('care',     'Feminine Care',       6),
  ('package',  'Gift Packages',       7);

INSERT INTO products (id, name, cat, gender, family, notes, descr) VALUES
  ('amouage-decision',   'Amouage Decision',            'designer', 'Unisex', 'Woody',    'Oud, saffron, smoked amber',            'A decisive oud — dark, resinous, and quietly commanding. For the one who has already arrived.'),
  ('pdm-valaya',         'PDM Valaya',                  'designer', 'Female', 'Fresh',    'White musk, orange blossom, vanilla',   'Clean linen and morning light — a fresh trail that lingers long after you leave the room.'),
  ('flames',             'Flames',                      'sensual',  'Female', 'Amber',    'Amber, tonka, warm spice',              'A slow-burning amber for evenings that are meant to be remembered.'),
  ('ani-nishane',        'Ani Nishane',                 'designer', 'Unisex', 'Gourmand', 'Ginger, vanilla, blue ambergris',       'Sparkling ginger over deep vanilla — luminous, generous, unforgettable.'),
  ('bare-secret',        'Bare Secret',                 'sensual',  'Female', 'Floral',   'Jasmine, skin musk, sandalwood',        'Worn close — a your-skin-but-softer whisper that draws people nearer.'),
  ('hypnotic-poison',    'Hypnotic Poison',             'designer', 'Female', 'Gourmand', 'Bitter almond, jasmine, vanilla musk',  'Hypnotic by name and by nature — almond and vanilla with a dangerous edge.'),
  ('pulze',              'Pulze',                       'extrait',  'Male',   'Fresh',    'Bergamot, sea notes, cedar',            'A crisp, kinetic extrait for kings who move with intent.'),
  ('addictive-ambergris','Addictive Ambergris',         'extrait',  'Unisex', 'Amber',    'Ambergris, labdanum, musk',             'True to its name — an ambergris trail people follow across a room.'),
  ('imagination-lv',     'Imagination LV',              'designer', 'Male',   'Fresh',    'Citrus, black tea, ambrette',           'Bright citrus resolved into cool black tea — imagination, bottled.'),
  ('pacific-chill',      'Pacific Chill',               'designer', 'Unisex', 'Fresh',    'Lemon, coriander, apricot',             'A cold-pressed morning by the water — effortless and clean.'),
  ('reef-33',            'Reef 33',                     'extrait',  'Male',   'Woody',    'Vetiver, salt, driftwood',              'Salt-washed woods with a mineral edge — quiet strength.'),
  ('addicted-to-you',    'Addicted To You',             'mist',     'Female', 'Gourmand', 'Peach, brown sugar, musk',              'A soft gourmand mist made for everyday devotion.'),
  ('night-fire',         'Night Fire',                  'sensual',  'Female', 'Amber',    'Oud, rose, warm honey',                 'The one the testimonials whisper about — light it carefully.'),
  ('hello-freshpits',    'Hello Freshpits',             'deo',      'Unisex', 'Fresh',    'Aloe, shea, natural deodorant',         'A gentle, aluminium-free deodorant that keeps fresh all day — 50ml.'),
  ('armpitox',           'Armpitox Detox Mask',         'care',     'Female', 'Care',     'Bentonite clay, charcoal, tea tree',    'A weekly underarm detox moment — resets, brightens, and calms.'),
  ('opulent-peach',      'Opulent Peach Box',           'package',  'Female', 'Gourmand', 'Perfume oil, mist & care set',          'The signature gift box — a curated peach-toned moment for a queen.'),
  ('opulent-combo',      'Opulent Pink & Peach Combo',  'package',  'Female', 'Floral',   'Two full opulent boxes',                'Both opulent collections, together — the grandest gesture in the house.');

INSERT INTO variants (id, product_id, size, price_ngn) VALUES
  (1,  'amouage-decision',    '50ml', 50000),
  (2,  'pdm-valaya',          '50ml', 50000),
  (3,  'flames',              '30ml', 30000),
  (4,  'ani-nishane',         '50ml', 50000),
  (5,  'bare-secret',         '30ml', 35000),
  (6,  'hypnotic-poison',     '30ml', 25000),
  (7,  'hypnotic-poison',     '50ml', 50000),
  (8,  'pulze',               '30ml', 30000),
  (9,  'addictive-ambergris', '50ml', 55000),
  (10, 'imagination-lv',      '50ml', 50000),
  (11, 'pacific-chill',       '50ml', 50000),
  (12, 'reef-33',             '30ml', 30000),
  (13, 'addicted-to-you',     '30ml', 30000),
  (14, 'night-fire',          '30ml', 32000),
  (15, 'hello-freshpits',     '50ml', 12000),
  (16, 'armpitox',            '100g', 15000),
  (17, 'opulent-peach',       'Set',  85000),
  (18, 'opulent-combo',       'Set',  150000);

INSERT INTO stock (variant_id, location_id, qty) VALUES
  (1,'abuja',8),(1,'lagos',12),(1,'ibadan',3),
  (2,'abuja',14),(2,'lagos',6),(2,'ibadan',0),
  (3,'abuja',20),(3,'lagos',0),(3,'ibadan',6),
  (4,'abuja',5),(4,'lagos',9),(4,'ibadan',2),
  (5,'abuja',11),(5,'lagos',4),(5,'ibadan',0),
  (6,'abuja',9),(6,'lagos',15),(6,'ibadan',5),
  (7,'abuja',4),(7,'lagos',10),(7,'ibadan',0),
  (8,'abuja',0),(8,'lagos',18),(8,'ibadan',7),
  (9,'abuja',6),(9,'lagos',8),(9,'ibadan',1),
  (10,'abuja',3),(10,'lagos',11),(10,'ibadan',0),
  (11,'abuja',0),(11,'lagos',7),(11,'ibadan',4),
  (12,'abuja',13),(12,'lagos',2),(12,'ibadan',8),
  (13,'abuja',17),(13,'lagos',9),(13,'ibadan',12),
  (14,'abuja',7),(14,'lagos',5),(14,'ibadan',0),
  (15,'abuja',25),(15,'lagos',20),(15,'ibadan',15),
  (16,'abuja',18),(16,'lagos',0),(16,'ibadan',9),
  (17,'abuja',4),(17,'lagos',6),(17,'ibadan',2),
  (18,'abuja',2),(18,'lagos',3),(18,'ibadan',0);

-- Demo order history (drives dashboard KPIs, revenue chart & tracking demo)
INSERT INTO orders (no, customer, phone, email, city, address, fulfilled_from, method, pay, pay_status, status, subtotal, discount, shipping, total, all_in_city, placed_at) VALUES
  ('MR-10234', 'Adaeze Okafor', '0803 221 4409', 'adaeze.o@gmail.com',      'abuja',  '12 Mississippi Close, Maitama',  'abuja',  'Delivery',        'Paystack',      'paid', 'In transit',       90000, 0, 2500, 92500, 1, '2026-07-14 09:12:00'),
  ('MR-10233', 'Tunde Bakare',  '0812 990 1123', 'tbakare@yahoo.com',       'lagos',  '',                               'lagos',  'Click & collect', 'Bank transfer', 'paid', 'Ready for pickup', 30000, 0, 0,    30000, 1, '2026-07-14 11:40:00'),
  ('MR-10232', 'Hauwa Bello',   '0705 334 8871', 'hauwa.b@gmail.com',       'abuja',  '4 Ganges St, Wuse 2',            'lagos',  'Delivery',        'Paystack',      'paid', 'In transit',       50000, 0, 4500, 54500, 0, '2026-07-13 15:02:00'),
  ('MR-10231', 'Chika Eze',     '0809 118 2234', 'chika.eze@outlook.com',   'ibadan', '7 Oyo Rd, Sango',                'ibadan', 'Delivery',        'WhatsApp',      'paid', 'Delivered',        60000, 0, 3500, 63500, 1, '2026-07-12 10:30:00'),
  ('MR-10230', 'Mariam Sule',   '0816 445 0912', 'mariam.s@gmail.com',      'lagos',  '18 Fola Osibo, Lekki 1',         'lagos',  'Delivery',        'Paystack',      'paid', 'Delivered',        85000, 0, 3000, 88000, 1, '2026-07-12 13:15:00'),
  ('MR-10229', 'Ngozi Adeleke', '0703 776 5541', 'ngoziadeleke@gmail.com',  'abuja',  '',                               'abuja',  'Click & collect', 'Paystack',      'paid', 'Collected',        65000, 0, 0,    65000, 1, '2026-07-11 09:05:00'),
  ('MR-10228', 'Yemi Alade',    '0802 334 5566', 'yemi.a@gmail.com',        'lagos',  '3 Bourdillon Rd, Ikoyi',         'lagos',  'Delivery',        'Paystack',      'paid', 'Delivered',        105000, 10500, 0, 94500, 1, '2026-07-22 17:20:00'),
  ('MR-10227', 'Sani Garba',    '0805 221 9903', 'sani.g@yahoo.com',        'abuja',  '22 Lake Chad Cres, Maitama',     'abuja',  'Delivery',        'Bank transfer', 'paid', 'In transit',       55000, 0, 2500, 57500, 1, '2026-07-21 12:00:00'),
  ('MR-10226', 'Amara Obi',     '0908 776 1120', 'amara.obi@gmail.com',     'ibadan', '11 Awolowo Ave, Bodija',         'ibadan', 'Delivery',        'Paystack',      'paid', 'Delivered',        45000, 0, 3500, 48500, 1, '2026-07-20 10:45:00'),
  ('MR-10225', 'Bisi Falana',   '0811 220 3345', 'bisi.f@outlook.com',      'lagos',  '5 Admiralty Way, Lekki 1',       'lagos',  'Click & collect', 'Paystack',      'paid', 'Collected',        150000, 0, 0, 150000, 1, '2026-07-19 16:30:00'),
  ('MR-10224', 'Efe Ojo',       '0703 445 8890', 'efe.ojo@gmail.com',       'abuja',  '9 Panama St, Maitama',           'abuja',  'Delivery',        'Paystack',      'paid', 'Delivered',        62000, 6200, 2500, 58300, 1, '2026-07-18 09:55:00'),
  ('MR-10223', 'Halima Musa',   '0806 990 2211', 'halima.m@gmail.com',      'abuja',  '2 Kwame Nkrumah Cres, Asokoro',  'abuja',  'Delivery',        'WhatsApp',      'paid', 'Delivered',        35000, 0, 2500, 37500, 1, '2026-07-17 14:10:00'),
  ('MR-10222', 'Dami Adeyemi',  '0902 118 4432', 'dami.a@yahoo.com',        'lagos',  '14 Freedom Way, Lekki 1',        'lagos',  'Delivery',        'Paystack',      'paid', 'Delivered',        80000, 0, 3000, 83000, 1, '2026-07-16 11:25:00'),
  ('MR-10221', 'Kelechi Nwosu', '0809 556 7788', 'kelechi.n@gmail.com',     'ibadan', '20 Bodija Market Rd',            'ibadan', 'Click & collect', 'Bank transfer', 'paid', 'Collected',        30000, 0, 0,    30000, 1, '2026-07-15 15:40:00'),
  ('MR-10220', 'Aisha Bello',   '0817 223 9911', 'aisha.b@gmail.com',       'abuja',  '6 Gana St, Maitama',             'abuja',  'Delivery',        'Paystack',      'paid', 'Delivered',        112000, 0, 0, 112000, 1, '2026-07-10 10:05:00'),
  ('MR-10219', 'Tobi Lawal',    '0701 887 6655', 'tobi.l@outlook.com',      'lagos',  '8 Providence St, Lekki 1',       'lagos',  'Delivery',        'Paystack',      'paid', 'Delivered',        50000, 0, 3000, 53000, 1, '2026-07-09 13:50:00');

INSERT INTO order_items (order_no, product_id, name, size, qty, unit_ngn) VALUES
  ('MR-10234', 'flames', 'Flames', '30ml', 1, 30000),
  ('MR-10234', 'addicted-to-you', 'Addicted To You', '30ml', 2, 30000),
  ('MR-10233', 'pulze', 'Pulze', '30ml', 1, 30000),
  ('MR-10232', 'pacific-chill', 'Pacific Chill', '50ml', 1, 50000),
  ('MR-10231', 'reef-33', 'Reef 33', '30ml', 2, 30000),
  ('MR-10230', 'opulent-peach', 'Opulent Peach Box', 'Set', 1, 85000),
  ('MR-10229', 'hypnotic-poison', 'Hypnotic Poison', '50ml', 1, 50000),
  ('MR-10229', 'armpitox', 'Armpitox Detox Mask', '100g', 1, 15000),
  ('MR-10228', 'addictive-ambergris', 'Addictive Ambergris', '50ml', 1, 55000),
  ('MR-10228', 'hypnotic-poison', 'Hypnotic Poison', '50ml', 1, 50000),
  ('MR-10227', 'addictive-ambergris', 'Addictive Ambergris', '50ml', 1, 55000),
  ('MR-10226', 'flames', 'Flames', '30ml', 1, 30000),
  ('MR-10226', 'armpitox', 'Armpitox Detox Mask', '100g', 1, 15000),
  ('MR-10225', 'opulent-combo', 'Opulent Pink & Peach Combo', 'Set', 1, 150000),
  ('MR-10224', 'night-fire', 'Night Fire', '30ml', 1, 32000),
  ('MR-10224', 'addicted-to-you', 'Addicted To You', '30ml', 1, 30000),
  ('MR-10223', 'bare-secret', 'Bare Secret', '30ml', 1, 35000),
  ('MR-10222', 'hypnotic-poison', 'Hypnotic Poison', '30ml', 1, 25000),
  ('MR-10222', 'addictive-ambergris', 'Addictive Ambergris', '50ml', 1, 55000),
  ('MR-10221', 'reef-33', 'Reef 33', '30ml', 1, 30000),
  ('MR-10220', 'opulent-peach', 'Opulent Peach Box', 'Set', 1, 85000),
  ('MR-10220', 'flames', 'Flames', '30ml', 1, 30000),
  ('MR-10219', 'imagination-lv', 'Imagination LV', '50ml', 1, 50000),
  ('MR-10219', 'hello-freshpits', 'Hello Freshpits', '50ml', 1, 12000);

INSERT INTO order_events (order_no, step, detail, at, done, current, sort) VALUES
  ('MR-10234', 'Order placed', 'Paid via Paystack — ₦92,500', 'Jul 14, 9:12 AM', 1, 0, 1),
  ('MR-10234', 'Routed to Life Camp Store, Abuja', 'All items in stock at your nearest store', 'Jul 14, 9:13 AM', 1, 0, 2),
  ('MR-10234', 'Packed & perfumed', 'Hand-wrapped with your gift note', 'Jul 14, 4:40 PM', 1, 0, 3),
  ('MR-10234', 'In transit', 'With our Abuja dispatch rider', 'Jul 15, 10:05 AM', 1, 1, 4),
  ('MR-10234', 'Delivered', 'Estimated Jul 16', NULL, 0, 0, 5),
  ('MR-10233', 'Order placed', 'Bank transfer confirmed — ₦30,000', 'Jul 14, 11:40 AM', 1, 0, 1),
  ('MR-10233', 'Packed & perfumed', 'Ready at Lekki Store', 'Jul 14, 2:10 PM', 1, 0, 2),
  ('MR-10233', 'Ready for pickup', 'We''ll hold it for 5 days', 'Jul 14, 2:12 PM', 1, 1, 3),
  ('MR-10232', 'Order placed', 'Paid via Paystack — ₦54,500', 'Jul 13, 3:02 PM', 1, 0, 1),
  ('MR-10232', 'Routed to Lekki Store, Lagos', 'Nearest store holding your full order', 'Jul 13, 3:03 PM', 1, 0, 2),
  ('MR-10232', 'In transit', 'Cross-city shipment to Abuja', 'Jul 14, 9:00 AM', 1, 1, 3),
  ('MR-10232', 'Delivered', 'Estimated Jul 17', NULL, 0, 0, 4),
  ('MR-10231', 'Order placed', 'Ordered via WhatsApp — ₦63,500', 'Jul 12, 10:30 AM', 1, 0, 1),
  ('MR-10231', 'Packed & perfumed', 'Hand-wrapped with a note', 'Jul 12, 1:00 PM', 1, 0, 2),
  ('MR-10231', 'Delivered', 'Received by customer', 'Jul 13, 4:20 PM', 1, 1, 3);

INSERT INTO promos (code, kind, value, descr, scope, starts, ends, status, redemptions) VALUES
  ('QUEEN10',    'pct', 10,    '10% off all fragrances',            'Fragrances',    'Jul 1',     'Jul 31', 'Active', 214),
  ('FIRSTTRAIL', 'pct', 10,    '10% off first order (lead capture)','Storewide',     'Always on', '—',      'Active', 861),
  ('OPULENT25',  'amt', 25000, '₦25,000 off Opulent Combo',         'Gift packages', 'Jul 10',    'Jul 20', 'Active', 37),
  ('EIDROYALE',  'pct', 15,    '15% off storewide',                 'Storewide',     'Jun 5',     'Jun 9',  'Ended',  502);

INSERT INTO campaigns (name, kind, audience, status, stat, title, message, cta, created_at) VALUES
  ('Opulent Launch Popup',        'Popup', 'First-time visitors', 'Live',       '4.8% conversion', '10% off your first order', 'Leave your email — we''ll send the code, and only what''s worth reading.', 'Claim it', '2026-07-01 09:00:00'),
  ('Back in stock — Night Fire',  'Push',  'Waitlist (Ibadan)',   'Scheduled',  '312 recipients',  'Night Fire returns', 'Back in Ibadan this week — reserve yours.', 'Reserve', '2026-07-15 09:00:00'),
  ('July Promo Email Blast',      'Email', 'All subscribers',     'Sent Jul 8', '38% open rate',   'QUEEN10 — July only', '10% off all fragrances through July.', 'Shop now', '2026-07-08 09:00:00'),
  ('Abandoned cart recovery',     'Email', 'Automated',           'Live',       '12% recovered',   'Your trail is waiting', 'The pieces in your cart are still yours — for now.', 'Finish checkout', '2026-06-20 09:00:00');

INSERT INTO inquiries (id, name, contact, channel, subject, city, status, created_at) VALUES
  (1, 'Blessing A.', 'blessing.a@gmail.com', 'Live chat', 'Is Night Fire back in Ibadan?',       'Ibadan', 'Open',     '2026-07-23 08:40:00'),
  (2, 'Emeka O.',    '0803 555 1212',        'WhatsApp',  'Order MR-10232 delivery window',      'Abuja',  'Open',     '2026-07-23 08:10:00'),
  (3, 'Fatima Y.',   'fatima.y@gmail.com',   'Email',     'Bulk order for wedding souvenirs',    'Lagos',  'Open',     '2026-07-23 06:45:00'),
  (4, 'Osas I.',     'osas.i@yahoo.com',     'Live chat', 'Payment failed but debited',          'Lagos',  'Pending',  '2026-07-23 05:30:00'),
  (5, 'Kemi D.',     'kemi.d@gmail.com',     'Email',     'Thank you! (Opulent box)',            'Abuja',  'Resolved', '2026-07-22 15:00:00');

INSERT INTO inquiry_messages (inquiry_id, from_us, text, created_at) VALUES
  (1, 0, 'Hi! Night Fire shows ''ships from Abuja'' for me — when will it be back in Ibadan?', '2026-07-23 08:40:00'),
  (2, 0, 'Good afternoon, please what day exactly will MR-10232 arrive? It''s a gift.', '2026-07-23 08:10:00'),
  (2, 1, 'Good afternoon Emeka — it left our Lekki store this morning and is on schedule for Thursday.', '2026-07-23 08:20:00'),
  (2, 0, 'Thursday works. Please add a gift note if possible 🙏', '2026-07-23 08:25:00'),
  (3, 0, 'Hello, I''d like 40 units of Addicted To You mist for a wedding in September. Do you offer bulk pricing and custom wrapping?', '2026-07-23 06:45:00'),
  (4, 0, 'My transfer went through but the order page said failed. Ref: TRF-88231.', '2026-07-23 05:30:00'),
  (4, 1, 'So sorry Osas — checking with Paystack now, we''ll confirm within the hour.', '2026-07-23 05:45:00'),
  (5, 0, 'The peach box made my sister cry happy tears. Thank you for the handwritten note.', '2026-07-22 15:00:00'),
  (5, 1, 'This made our day, Kemi — quietly filed under moments we work for. 💜', '2026-07-22 15:30:00');

INSERT INTO abandoned_checkouts (contact_key, name, phone, email, city, value_ngn, stage, updated_at) VALUES
  ('zainab.musa@gmail.com', 'Zainab Musa',  '0807 552 1180', 'zainab.musa@gmail.com', 'Lagos',  50000, 'Payment',          '2026-07-23 08:20:00'),
  ('ibrahim.k@yahoo.com',   'Ibrahim Kalu', '0703 908 4412', 'ibrahim.k@yahoo.com',   'Abuja',  92000, 'Delivery details', '2026-07-23 07:40:00'),
  ('graceo@outlook.com',    'Grace Otu',    '0810 337 6650', 'graceo@outlook.com',    'Ibadan', 30000, 'Cart',             '2026-07-23 06:40:00'),
  ('s.idris@gmail.com',     'Samuel Idris', '0802 771 3098', 's.idris@gmail.com',     'Lagos',  65000, 'Payment',          '2026-07-23 04:40:00');

INSERT INTO settings (key, value) VALUES ('site', json('
{
  "announcement": "QUEEN10 — 10% off all fragrances through July · Free Abuja delivery over ₦100,000",
  "heroHeadline": "Leave a trail,\nnot just an impression.",
  "heroSub": "Extrait perfume oils, body mists and moments for kings and queens — blended in Nigeria, worn everywhere.",
  "footerTagline": "Seductive fragrances and organic feminine care for premium high-value kings and queens — leave a trail, not just an impression.",
  "igUrl": "https://instagram.com/majesticroobee",
  "igHandle": "@majesticroobee",
  "contactPhone": "+234 906 227 7470",
  "contactEmail": "hello@majesticroobee.com",
  "contactHours": "9am to 9pm WAT",
  "ngnPerUsd": 1550,
  "crossCityShipNGN": 4500,
  "crossCityEta": "3–5 days",
  "freeShipAbujaOver": 100000,
  "lowStockThreshold": 5,
  "heroDirection": "editorial split",
  "promoPopup": true,
  "defaultCity": "abuja"
}
'));
