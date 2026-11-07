// Removes personal data from crash reports before they leave the phone.
//
// Crash reports are for fixing the app, not for knowing who had the crash. They
// never carry the person's account, email, phone number, boarding code, sign-in
// tokens or the query part of URLs (Supabase queries contain row ids and filters).
// This file has no Sentry import so the rules can be unit-tested on their own.

const PATTERNS: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'], // JWTs (Supabase access tokens)
  [/TOGO:[^\s"'&]+/g, 'TOGO:[code]'], // boarding QR payloads
  [/\b(code|access_token|refresh_token|token|apikey|password)=[^\s&#"']+/gi, '$1=[removed]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]'],
  [/(\+?256|\b0)7\d{8}\b/g, '[phone]'], // Ugandan mobile numbers
  [/\+\d[\d\s-]{7,}\d/g, '[phone]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'], // row ids
];

export function scrubText(s: string): string;
export function scrubText(s: string | undefined): string | undefined;
export function scrubText(s: string | undefined): string | undefined {
  if (typeof s !== 'string') return s;
  return PATTERNS.reduce((out, [re, rep]) => out.replace(re, rep), s);
}

/** Keep only the scheme, host and path of a URL; drop the query and fragment. */
export function scrubUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string') return url;
  const cut = url.search(/[?#]/);
  return scrubText(cut >= 0 ? url.slice(0, cut) : url);
}

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose | undefined => (v && typeof v === 'object' ? (v as Loose) : undefined);

function scrubBreadcrumbInPlace(b: Loose): Loose {
  if (typeof b.message === 'string') b.message = scrubText(b.message);
  const data = obj(b.data);
  if (data) {
    if (typeof data.url === 'string') data.url = scrubUrl(data.url);
    if (typeof data.to === 'string') data.to = scrubUrl(data.to); // navigation
    if (typeof data.from === 'string') data.from = scrubUrl(data.from);
    delete data.body;
    delete data.arguments; // console.* arguments
    delete data.params; // route params can hold booking ids
  }
  return b;
}

/** A Sentry breadcrumb with personal data removed. */
export function scrubBreadcrumb<T>(crumb: T): T {
  const b = obj(crumb);
  return (b ? scrubBreadcrumbInPlace(b) : crumb) as T;
}

/** A Sentry event with personal data removed (it is changed in place and returned). */
export function scrubEvent<T>(event: T): T {
  const e = obj(event);
  if (!e) return event;
  delete e.user;
  delete e.extra;
  delete e.server_name;
  const req = obj(e.request);
  if (req) {
    delete req.cookies;
    delete req.headers;
    delete req.data;
    delete req.query_string;
    if (typeof req.url === 'string') req.url = scrubUrl(req.url);
  }
  if (typeof e.message === 'string') e.message = scrubText(e.message);
  const logentry = obj(e.logentry);
  if (logentry && typeof logentry.message === 'string') logentry.message = scrubText(logentry.message);
  const values = obj(e.exception)?.values;
  if (Array.isArray(values)) {
    for (const v of values) {
      const ex = obj(v);
      if (ex && typeof ex.value === 'string') ex.value = scrubText(ex.value);
    }
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map((b) => scrubBreadcrumb(b));
  }
  return event;
}
