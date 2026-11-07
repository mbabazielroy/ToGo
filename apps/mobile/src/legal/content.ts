// In-app privacy policy and terms of use.
//
// This text describes what the app actually does. Keep it in step with the code
// and with the App Store "App Privacy" / Play "Data safety" answers in
// docs/STORE_LAUNCH.md. The operating company's details come from
// EXPO_PUBLIC_LEGAL_NAME, EXPO_PUBLIC_LEGAL_ADDRESS and EXPO_PUBLIC_SUPPORT_EMAIL.

export interface LegalSection { heading: string; body: string[] }

// Who runs ToGo. Set per deployment (EAS environment variables; the web build reads
// the same names). Store builds refuse to build without them (app.config.js).
// Written as direct process.env.EXPO_PUBLIC_* reads so Expo inlines them.
const LEGAL_NAME = (process.env.EXPO_PUBLIC_LEGAL_NAME ?? '').trim();
const LEGAL_ADDRESS = (process.env.EXPO_PUBLIC_LEGAL_ADDRESS ?? '').trim();
const CONTACT = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
// Crash reporting is on in builds that set a Sentry key (src/lib/crashReporting.ts).
// The website's legal pages must be built with the same value as the apps.
const CRASH_REPORTS = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim().startsWith('https://');

function whoWeAre(role: string): LegalSection {
  const who = LEGAL_NAME ? `ToGo is provided by ${LEGAL_NAME}${LEGAL_ADDRESS ? `, ${LEGAL_ADDRESS}` : ''}` : 'ToGo is provided by the ToGo operations team';
  return {
    heading: 'Who we are',
    body: [`${who}, ${role}.`, CONTACT ? `Contact: ${CONTACT}.` : 'Contact us through Account → Help in the app.'],
  };
}
export interface LegalDoc { title: string; updated: string; intro: string; sections: LegalSection[] }

export const PRIVACY: LegalDoc = {
  title: 'Privacy policy',
  updated: '6 November 2026',
  intro: 'This explains what ToGo collects, why, and the choices you have. ToGo has no ads, sells no data and does not track you across other apps or websites.',
  sections: [
    whoWeAre('which is responsible for your personal data in ToGo (the data controller)'),
    {
      heading: 'What we collect',
      body: [
        'Account: your email address and password (stored only as a secure hash by our hosting provider), your name and, if you add it, your mobile number.',
        'Trips: the departures you reserve, your pickup and drop-off hubs, seats, booking reference, and check-in and boarding status.',
        'Alerts: the in-app messages we show you about your trips (delays, boarding, changes).',
        ...(CRASH_REPORTS
          ? ['Crash reports: if the app crashes or hits an error, it sends a report so we can fix it: what went wrong, the app version, and your phone model and system version. Reports do not include your name, email, phone number, boarding code or location, and are not linked to your account.']
          : []),
        'Staff only: when a driver starts a trip, the ToGo Staff app sends the bus’s location about every 30 seconds while the app is open on the driver’s phone, so passengers can see where the bus is. It stops when the trip ends, the driver signs out or the app is closed. It never runs in the background.',
      ],
    },
    {
      heading: 'What stays on your phone',
      body: [
        'Your own location. If you allow it, the map uses it to show where you are and which hub is nearest. It is not sent to ToGo.',
        'The camera. Staff use it to scan boarding codes. Images are not saved or uploaded.',
        'Your sign-in session, kept in the phone’s secure storage, and app settings such as your home city.',
        'Trip reminders. If you allow notifications, reminders for your reservations are scheduled on your phone; nothing is sent to us to do this.',
        'Your upcoming boarding passes, so you can show them at a hub without signal. Each copy is removed 12 hours after pickup, and all of them when you sign out or delete your account.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To hold your seat, show your boarding pass, and tell the crew how many people to pick up at each hub.',
        'Your conductor and hub attendant see your name, seats, hubs and booking status for trips you reserved. They do not see your email or phone number.',
        'To send you the alerts you turned on, and to help when you contact support.',
      ],
    },
    {
      heading: 'Who it is shared with',
      body: [
        'The bus operator running your trip, for the purposes above.',
        'Our hosting provider (Supabase), which stores the data for us under contract.',
        ...(CRASH_REPORTS ? ['Our crash-reporting provider (Sentry), which receives the crash reports described above, under contract. Reports are kept for no more than 90 days.'] : []),
        'Authorities, only if the law requires it.',
        'Nobody else. We do not sell personal data or use it for advertising.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Your account and trip history are kept while you have an account. When you delete your account, your profile, bookings and alerts are deleted straight away. Records of actions you took on other people’s trips (for example, as crew) are kept for safety and accounting, without your identity.',
      ],
    },
    {
      heading: 'Your choices and rights',
      body: [
        'You can view and edit your profile in Account at any time.',
        'Delete your account from Account → Delete account. This is permanent. Without the app, ask support to delete it (see the “Delete your account” page on our website); we do so within 30 days.',
        'You can turn location and camera access off in your phone’s settings; the app keeps working without them.',
        'You can ask for a copy of your data, or a correction, by contacting support. You also have the rights given by Uganda’s Data Protection and Privacy Act, 2019, including complaining to the Personal Data Protection Office.',
      ],
    },
    {
      heading: 'Children',
      body: ['ToGo is not intended for children under 13, and we do not knowingly collect their data.'],
    },
    {
      heading: 'Changes',
      body: ['If this policy changes in a way that matters, we will tell you in the app before it takes effect.'],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: 'Terms of use',
  updated: '5 November 2026',
  intro: 'These terms cover your use of the ToGo app. By creating an account or reserving a seat you agree to them.',
  sections: [
    whoWeAre('which offers the app'),
    {
      heading: 'What ToGo does',
      body: [
        'ToGo lets you reserve seats on bus departures run by independent operators between Kampala and Mbarara, follow the bus, and board with a code.',
        'The operator, not ToGo, runs the bus and is responsible for the journey itself.',
      ],
    },
    {
      heading: 'Reservations and payment',
      body: [
        'A reservation holds your seats until the bus leaves your pickup hub. You pay the operator’s fare to the conductor when you board. ToGo never takes payment in the app.',
        'Arrive at your hub about 15 minutes before your pickup time and check in. The bus may not wait for late passengers, and check-in closes once it has left your hub.',
        'You can cancel any time before you board; your seats are released straight away.',
      ],
    },
    {
      heading: 'Times and tracking',
      body: [
        'Departure times, delays and bus positions come from the operator and the driver’s phone. They can be wrong or out of date, so allow some margin.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Keep your password private and give accurate details. Do not reserve seats you do not intend to use or misuse the service; we may suspend accounts that do.',
        'You can delete your account at any time from Account.',
      ],
    },
    {
      heading: 'Staff',
      body: ['ToGo Staff accounts are issued by an operator or ToGo. Staff may use passenger information only to run the trips they are assigned to.'],
    },
    {
      heading: 'Liability',
      body: [
        'The app is provided as is. To the extent the law allows, ToGo is not liable for missed buses, delays or losses caused by the operator, by inaccurate times, or by the app being unavailable. Nothing in these terms limits rights you have under consumer law.',
      ],
    },
    {
      heading: 'Changes',
      body: ['We may update these terms. If a change matters, we will tell you in the app before it takes effect.'],
    },
  ],
};
