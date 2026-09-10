// ID / code generation helpers. Deterministic-enough for a demo; collision-checked by callers.

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function randomChars(n: number, alphabet: string): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Booking reference, e.g. "TG-7K3Q". */
export function makeBookingRef(existing: Set<string> = new Set()): string {
  let ref = '';
  do {
    ref = `TG-${randomChars(4, REF_ALPHABET)}`;
  } while (existing.has(ref));
  return ref;
}

/** 4-digit boarding code, e.g. "8391". Kept readable for demo lookup. */
export function makeBoardingCode(existing: Set<string> = new Set()): string {
  let code = '';
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (existing.has(code));
  return code;
}

let counter = 0;
/** Reasonably-unique id for entities/events created at runtime. */
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${randomChars(4, REF_ALPHABET)}`;
}
