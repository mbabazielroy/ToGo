-- 0021 A notification kind for "your bus is on its way".
-- Kept separate: an enum value must be committed before 0022 uses it.
alter type notification_kind add value if not exists 'trip_started';
