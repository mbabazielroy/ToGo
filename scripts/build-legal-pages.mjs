// Builds the public web pages the App Store and Google Play listings link to:
//
//   public/legal/privacy.html          privacy policy URL (both stores)
//   public/legal/terms.html            terms of use
//   public/legal/delete-account.html   Google Play "delete account" URL: how to delete
//                                      an account without the app installed
//
// The text comes from the same source as the in-app screens
// (apps/mobile/src/legal/content.ts), so the web and app versions can't drift.
// Runs before `vite build` (see package.json), so every web deploy republishes them.
//
// Optional env: EXPO_PUBLIC_SUPPORT_EMAIL (or TOGO_SUPPORT_EMAIL) for the contact line.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'apps/mobile/src/legal/content.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { PRIVACY, TERMS } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const email = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL || process.env.TOGO_SUPPORT_EMAIL || '').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const contact = email
  ? `<p>Questions: <a href="mailto:${esc(email)}">${esc(email)}</a></p>`
  : '<p>Questions: use Account → Help in the ToGo app.</p>';

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ToGo</title>
<style>
  :root { color-scheme: light dark; --bg:#f2f2f7; --card:#fff; --ink:#111; --soft:#3c3c43; --muted:#6b6b70; --accent:#0c7a43; }
  @media (prefers-color-scheme: dark) { :root { --bg:#000; --card:#1c1c1e; --ink:#f2f2f7; --soft:#d1d1d6; --muted:#98989f; --accent:#30d158; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  .card { background:var(--card); border-radius:16px; padding:24px 20px; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 19px; margin: 28px 0 8px; }
  p, li { color: var(--soft); } .muted { color: var(--muted); font-size: 14px; }
  a { color: var(--accent); } nav { margin-bottom: 16px; font-size: 14px; } nav a { margin-right: 16px; }
  ol { padding-left: 22px; }
</style>
</head>
<body><main>
<nav><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms of use</a><a href="delete-account.html">Delete your account</a></nav>
<div class="card">
${body}
${contact}
</div>
</main></body>
</html>
`;
}

function doc(d) {
  const sections = d.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${s.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}`)
    .join('\n');
  return page(d.title, `<h1>${esc(d.title)}</h1>\n<p class="muted">Last updated ${esc(d.updated)}</p>\n<p>${esc(d.intro)}</p>\n${sections}`);
}

const deletion = page('Delete your account', `<h1>Delete your ToGo account</h1>
<p>You can permanently delete your ToGo account and its data at any time.</p>
<h2>In the app</h2>
<ol>
  <li>Open ToGo and sign in.</li>
  <li>Go to <strong>Account</strong>.</li>
  <li>Tap <strong>Delete account</strong> and confirm.</li>
</ol>
<h2>Without the app</h2>
<p>${email
    ? `Email <a href="mailto:${esc(email)}?subject=Delete%20my%20ToGo%20account">${esc(email)}</a> from the address you signed up with, with the subject “Delete my ToGo account”. We delete the account within 30 days and confirm by email.`
    : 'Contact ToGo support from the email address you signed up with and ask for your account to be deleted. We delete the account within 30 days and confirm by email.'}</p>
<h2>What is deleted</h2>
<p>Your profile (name, email, phone number), your reservations and your alerts are deleted, and any seats you were holding are released. Records of actions you took on other people’s trips (for example, as crew) are kept without your identity. ToGo Staff accounts are managed by your operator; ask them to remove yours.</p>`);

const out = join(root, 'public/legal');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'privacy.html'), doc(PRIVACY));
await writeFile(join(out, 'terms.html'), doc(TERMS));
await writeFile(join(out, 'delete-account.html'), deletion);
console.log('legal pages → public/legal/{privacy,terms,delete-account}.html');
