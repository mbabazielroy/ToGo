// Sends a push for each new service alert (delay, cancellation, schedule change,
// incident) added to public.notifications.
//
// Triggered by a Supabase Database Webhook: table public.notifications, event
// INSERT, type "Supabase Edge Functions", function "push", with an HTTP header
// `x-webhook-secret` equal to the PUSH_WEBHOOK_SECRET function secret. Deploy with
// `supabase functions deploy push --no-verify-jwt` (the shared secret is the check).
// See docs/BACKEND.md, "Push alerts".
//
// Secrets: PUSH_WEBHOOK_SECRET (required), EXPO_ACCESS_TOKEN (only if Expo push
// security is turned on). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
// by Supabase. Nothing personal is logged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildMessages, chunk, deadTokens, shouldPush, type NotificationRecord } from './messages.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  if (!secret || !timingSafeEqual(req.headers.get('x-webhook-secret') ?? '', secret)) {
    return new Response('Forbidden', { status: 403 });
  }

  let payload: { type?: string; table?: string; record?: NotificationRecord };
  try { payload = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const record = payload.record;
  if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !record || !shouldPush(record)) {
    return Response.json({ sent: 0, skipped: true });
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: rows, error } = await db.from('push_tokens').select('token').eq('user_id', record.user_id);
  if (error) return new Response('Token lookup failed', { status: 500 });
  const messages = buildMessages(record, (rows ?? []).map((r: { token: string }) => r.token));
  if (messages.length === 0) return Response.json({ sent: 0 });

  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.authorization = `Bearer ${expoToken}`;

  let sent = 0;
  const dead: string[] = [];
  for (const batch of chunk(messages)) {
    const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
    if (!res.ok) { console.error('expo push failed', res.status); continue; }
    const body = await res.json() as { data?: { status: string; details?: { error?: string } }[] };
    const tickets = body.data ?? [];
    sent += tickets.filter((t) => t.status === 'ok').length;
    dead.push(...deadTokens(batch, tickets));
  }
  // Forget phones that no longer accept pushes (app deleted, notifications reset).
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent, removed: dead.length });
});
