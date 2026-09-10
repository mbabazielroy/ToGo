-- 0015 Distinct, neutral outcome states for un-boarded reservations at completion.
-- Kept separate (enum values must be committed before use in 0016):
--   * missed_pickup — passenger CHECKED IN but was not boarded. This needs
--     operational investigation; the passenger did their part.
--   * not_boarded   — passenger RESERVED but never checked in or boarded. A neutral
--     not-boarded outcome. We do NOT assign passenger fault ("no-show") without an
--     explicit attendance policy.
-- The older 'no_show' value (0012) is retained for enum stability but is no longer
-- assigned by application logic.
alter type booking_status add value if not exists 'missed_pickup';
alter type booking_status add value if not exists 'not_boarded';
