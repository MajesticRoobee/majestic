-- The Perfume Studio's booking button is on.
--
-- Consultations shipped behind a switch that defaulted to off, so the header
-- tab, the floating button and the page all went live hidden, and the house
-- reported the button "can't be seen at all". The default is now on in code
-- (src/lib/consultation.js); this makes production agree even where the
-- settings panel had been saved with the switch still in its old off position.
-- Admin → Settings → The Perfume Studio can still turn it off.
--
-- Settings live as one JSON object in the `site` row, so this patches that
-- object rather than adding a row of its own.
UPDATE settings
   SET value = json_patch(value, json_object('consultOn', '1'))
 WHERE key = 'site';
