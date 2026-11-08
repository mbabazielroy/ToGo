import type { ReactNode } from 'react';
import {
  Armchair, MapPin, QrCode, Clock, BellRing, WifiOff, ShieldCheck, Navigation,
  ScanLine, ClipboardCheck, LayoutDashboard, Mail, Smartphone, Bus,
} from 'lucide-react';
import { APP_STORE_URL, PLAY_STORE_URL, SUPPORT_EMAIL, LEGAL_NAME } from './content';

/** The public ToGo website: what the app does, how it works, and where to get it. */
export function Site() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Operators />
        <Faq />
        <Download />
      </main>
      <Footer />
    </>
  );
}

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#operators', label: 'For operators' },
  { href: '#faq', label: 'FAQ' },
];

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-900/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5" aria-label="ToGo home">
          <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-[10px]" />
          <span className="text-xl font-extrabold tracking-tight">ToGo</span>
        </a>
        <nav className="ml-auto hidden gap-6 text-sm font-medium text-white/80 md:flex" aria-label="Main">
          {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-white">{n.label}</a>)}
        </nav>
        <a href="#download" className="ml-auto rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-brand-400 md:ml-0">
          Get the app
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-brand-900 text-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/10" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pb-28 md:pt-20">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-brand-300">
            <Bus size={16} /> Kampala ⇄ Mbarara
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Your bus. <span className="text-brand-400">Your stop.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">
            Reserve a seat on an intercity bus, meet it at a pickup hub near you, and board
            with one scan. No more waiting at the roadside wondering when, or whether, your
            bus will come.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <StoreButtons />
          </div>
          <p className="mt-4 text-sm text-white/60">Free to use. You pay the bus operator for your seat when you board.</p>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

/** An illustration of the boarding pass screen. */
function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[300px]" aria-hidden="true">
      <div className="rounded-[2.6rem] bg-black p-3 shadow-2xl ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[2rem] bg-[#f2f2f7] text-ink">
          <div className="flex items-center justify-between px-6 pb-2 pt-3 text-[11px] font-semibold">
            <span>9:41</span><span className="h-4 w-16 rounded-full bg-black" /><span>100%</span>
          </div>
          <div className="px-4 pb-3 text-center text-sm font-bold">Boarding pass</div>
          <div className="mx-3 mb-3 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted">To</div>
                <div className="text-xl font-bold">Mbarara</div>
              </div>
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">Reserved</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tabular-nums tracking-tight">07:30</div>
                <div className="text-[11px] text-muted">Pickup · Your nearest hub</div>
                <div className="mt-0.5 text-[11px] font-bold text-brand-700">Leave in 25 min</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold tabular-nums text-ink/70">12:10</div>
                <div className="text-[11px] text-muted">Est. arrival</div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <div className="rounded-xl border border-black/5 bg-white p-2"><QrCode size={112} strokeWidth={1.4} className="text-brand-900" /></div>
            </div>
            <div className="mt-2 text-center text-base font-bold tracking-[0.2em]">TG-4821</div>
            <div className="mt-1 text-center text-[10px] text-muted">Show this to the conductor</div>
          </div>
          <div className="mx-3 mb-5 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Navigation size={16} /></span>
            <div className="text-[11px] leading-tight"><div className="font-bold">Your bus is on its way</div><div className="text-muted">2 stops before your hub</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreButtons({ dark = true }: { dark?: boolean }) {
  const base = dark
    ? 'bg-white text-brand-900 hover:bg-brand-50'
    : 'bg-brand-900 text-white hover:bg-brand-800';
  const soon = dark ? 'bg-white/10 text-white ring-1 ring-white/20' : 'bg-white text-brand-900 ring-1 ring-black/10';
  const stores = [
    { url: APP_STORE_URL, icon: Smartphone, small: 'Download on the', big: 'App Store' },
    { url: PLAY_STORE_URL, icon: Smartphone, small: 'Get it on', big: 'Google Play' },
  ];
  return (
    <>
      {stores.map((s) => s.url ? (
        <a key={s.big} href={s.url} className={`flex items-center gap-3 rounded-2xl px-5 py-3 ${base}`}>
          <s.icon size={26} />
          <span className="text-left leading-tight"><span className="block text-[11px]">{s.small}</span><span className="block text-lg font-bold">{s.big}</span></span>
        </a>
      ) : (
        <div key={s.big} className={`flex items-center gap-3 rounded-2xl px-5 py-3 ${soon}`}>
          <s.icon size={26} />
          <span className="text-left leading-tight"><span className="block text-[11px] opacity-75">Coming soon to</span><span className="block text-lg font-bold">{s.big}</span></span>
        </div>
      ))}
    </>
  );
}

function Section({ id, eyebrow, title, intro, children, tone = 'white' }: {
  id: string; eyebrow: string; title: string; intro?: string; children: ReactNode; tone?: 'white' | 'grey';
}) {
  return (
    <section id={id} className={`scroll-mt-16 ${tone === 'grey' ? 'bg-[#f2f2f7]' : 'bg-white'}`}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-700">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/70">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Armchair, title: 'Reserve your seat', body: 'Pick a departure between Kampala and Mbarara, choose the pickup hub nearest you, and hold your seats in seconds.' },
  { icon: MapPin, title: 'Check in at your hub', body: 'Check-in opens two hours before pickup. Head to your hub and check in so the crew knows to stop for you.' },
  { icon: QrCode, title: 'Board with one scan', body: 'Show your boarding pass. The conductor scans it, you pay the operator for your seat, and you are on your way.' },
];

function HowItWorks() {
  return (
    <Section id="how-it-works" eyebrow="How it works" title="From your phone to your seat in three steps">
      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-3xl bg-[#f2f2f7] p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-900 text-brand-400"><s.icon size={24} /></span>
              <span className="text-sm font-bold text-brand-700">Step {i + 1}</span>
            </div>
            <h3 className="mt-5 text-xl font-bold text-ink">{s.title}</h3>
            <p className="mt-2 leading-relaxed text-ink/70">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const FEATURES = [
  { icon: Clock, title: 'Know when to leave', body: 'A live countdown to your pickup, adjusted when the bus runs late.' },
  { icon: Navigation, title: 'See your bus coming', body: 'Follow the bus on the map once the crew starts the trip.' },
  { icon: BellRing, title: 'Alerts that matter', body: 'Reminders before check-in and departure, plus a heads-up about delays and changes.' },
  { icon: WifiOff, title: 'Works without signal', body: 'Your boarding pass is saved on your phone, so it opens at the hub even with no network.' },
  { icon: MapPin, title: 'Hubs, not roadsides', body: 'Pickup hubs with directions, opening hours and facilities, so you know where to wait.' },
  { icon: ShieldCheck, title: 'Private by design', body: 'No ads and no tracking. Delete your account from the app at any time.' },
];

function Features() {
  return (
    <Section id="features" tone="grey" eyebrow="Features" title="Everything you need for the trip, nothing you don’t"
      intro="ToGo takes the guesswork out of catching an intercity bus, from the moment you reserve to the moment you step off.">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><f.icon size={22} /></span>
            <h3 className="mt-4 text-lg font-bold text-ink">{f.title}</h3>
            <p className="mt-1.5 leading-relaxed text-ink/70">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

const CREW = [
  { icon: Navigation, title: 'Drivers', body: 'Start the trip, share the bus’s position while it runs, and report delays in a tap.' },
  { icon: ScanLine, title: 'Conductors', body: 'See who is waiting at each hub and board passengers by scanning their pass.' },
  { icon: ClipboardCheck, title: 'Hub attendants', body: 'Check passengers in as they arrive and flag anyone who missed their bus.' },
  { icon: LayoutDashboard, title: 'Operations', body: 'Schedule departures, assign crews and follow every trip and issue in one place.' },
];

function Operators() {
  return (
    <section id="operators" className="scroll-mt-16 bg-brand-900 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand-400">For bus operators</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Fuller buses, fewer missed pickups</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/75">
            ToGo Staff is the companion app for your crews. Everyone works from the same
            live passenger list, so the bus stops where people are actually waiting.
          </p>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}?subject=ToGo%20for%20operators`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 font-bold text-brand-900 hover:bg-brand-400">
              <Mail size={18} /> Talk to us about your route
            </a>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREW.map((c) => (
            <div key={c.title} className="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
              <c.icon size={24} className="text-brand-400" />
              <h3 className="mt-4 text-lg font-bold">{c.title}</h3>
              <p className="mt-1.5 leading-relaxed text-white/70">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Do I pay for my ticket in the app?', a: 'No. ToGo holds your seat for free. You pay the bus operator for your seat when you board.' },
  { q: 'Which routes does ToGo cover?', a: 'ToGo starts on the Kampala–Mbarara corridor, in both directions, with pickup hubs along the way. More routes will follow.' },
  { q: 'What if my phone has no signal at the hub?', a: 'Your upcoming boarding passes are saved on your phone, so you can still open and show them without a connection.' },
  { q: 'What happens if my bus is late?', a: 'The app updates your countdown and tells you about the delay, so you can wait at home a little longer instead of at the roadside.' },
  { q: 'Can I cancel a reservation?', a: 'Yes. Cancel from your boarding pass and the seats go back to other passengers.' },
  { q: 'What do you do with my data?', a: <>We use it only to run your trips: no ads, no selling data and no tracking. Read the <a className="font-semibold text-brand-700 underline" href="/legal/privacy.html">privacy policy</a>, or see <a className="font-semibold text-brand-700 underline" href="/legal/delete-account.html">how to delete your account</a>.</> },
];

function Faq() {
  return (
    <Section id="faq" eyebrow="Questions" title="Frequently asked questions">
      <div className="max-w-3xl divide-y divide-black/10 rounded-3xl bg-[#f2f2f7] px-6">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-ink">
              {f.q}
              <span className="text-2xl leading-none text-brand-700 transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-ink/70">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Download() {
  const live = APP_STORE_URL || PLAY_STORE_URL;
  return (
    <section id="download" className="scroll-mt-16 bg-[#f2f2f7]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
          <img src="/logo.png" alt="" width={80} height={80} className="h-20 w-20 rounded-[22px] shadow-lg" />
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {live ? 'Get ToGo on your phone' : 'ToGo is coming soon'}
          </h2>
          <p className="mt-3 max-w-xl text-lg text-ink/70">
            {live
              ? 'Free on iPhone and Android.'
              : 'ToGo is launching on iPhone and Android. Check back here for the download links.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3"><StoreButtons dark={false} /></div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-900 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6 md:flex-row md:items-center">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <span className="font-bold text-white">ToGo</span>
          <span>© {new Date().getFullYear()} {LEGAL_NAME || 'ToGo'}</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 md:ml-auto" aria-label="Legal">
          <a href="/legal/privacy.html" className="hover:text-white">Privacy policy</a>
          <a href="/legal/terms.html" className="hover:text-white">Terms of use</a>
          <a href="/legal/delete-account.html" className="hover:text-white">Delete your account</a>
          {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">{SUPPORT_EMAIL}</a>}
        </nav>
      </div>
    </footer>
  );
}
