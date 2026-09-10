-- 0012 Add a distinct terminal state for reservations that were never boarded when
-- a trip completes. This keeps such passengers from being silently labelled as
-- having travelled ('completed'). Kept in its own migration because a new enum
-- value must be committed before it can be used by later statements.
alter type booking_status add value if not exists 'no_show';
