# ToGo — App Store and Google Play launch checklist

Two apps are built from `apps/mobile`:

| App | Variant | iOS bundle / Android package | EAS profile |
|---|---|---|---|
| **ToGo** (passengers) | `passenger` | `app.togo.mobile` | `production` |
| **ToGo Staff** (crew + operations) | `staff` | `app.togo.staff` | `production-staff` |

Store builds always run in **connected mode** (real Supabase). Preview mode
(`EXPO_PUBLIC_TOGO_DEMO=1`) is for development only and must never ship: Apple
rejects demo apps (guideline 2.1), and preview data is fictional.

---

## 1. Done in the app

| Requirement | Where |
|---|---|
| App icon (1024², no transparency) and Android adaptive + monochrome icons, separate for each app | `apps/mobile/assets/` |
| Splash screen for each app | `app.json`, `app.config.js` |
| Version 1.0.0, iOS build number and Android version code (EAS auto-increments in production) | `app.json` |
| In-app **account deletion** (Apple 5.1.1(v), Google Play account-deletion policy) | Account → Delete account; server function `supabase/migrations/0019_delete_my_account.sql` |
| In-app **privacy policy** and **terms of use**, linked from onboarding, sign-up, Account, crew Profile and staff sign-in | `app/legal.tsx`, `src/legal/content.ts` |
| Consent line at onboarding and account creation | `app/onboarding.tsx`, `app/auth.tsx` |
| Permission strings say exactly what each permission is for | `app.json` plugins |
| No background location; microphone, background location and storage permissions blocked on Android | `app.json` → `android.blockedPermissions` |
| iOS privacy manifest (required-reason APIs and collected data); staff app adds precise location | `app.json`, `app.config.js` |
| Export compliance answered (`ITSAppUsesNonExemptEncryption: false`, HTTPS only) | `app.json` |
| iPhone only (no iPad build, so no iPad screenshots needed) | `ios.supportsTablet: false` |
| Staff accounts can't be created in the app (operators issue them) | `app/auth.tsx` |
| No "pilot", "illustrative" or "demo" wording in connected mode | checked in the release bundles |
| Android Google Maps key read at build time | `app.config.js` (`GOOGLE_MAPS_ANDROID_API_KEY`) |

## 2. Before the first store build (your accounts and decisions)

1. **Legal entity and contact.** Fill in who runs ToGo (company name, address, a
   support email) in `src/legal/content.ts`, and have a lawyer review both documents
   against Uganda's Data Protection and Privacy Act 2019. Register with the Personal
   Data Protection Office if required.
2. **Host the policies.** Publish the privacy policy and terms at public URLs (both
   stores require the privacy URL on the listing). Set `EXPO_PUBLIC_PRIVACY_URL`,
   `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_SUPPORT_EMAIL`.
3. **Supabase.** Create the production project, run every migration in
   `supabase/migrations` in order (including `0018` and `0019`), and set
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment
   variables for the `production` and `production-staff` profiles. Set the auth
   redirect URLs to `togo://` and `togostaff://`.
4. **Google Maps key** for Android: create one in Google Cloud, restrict it to the
   two package names and their signing SHA-1, and add it as the EAS secret
   `GOOGLE_MAPS_ANDROID_API_KEY`.
5. **Developer accounts.** Apple Developer Program ($99/yr) and Google Play Console
   ($25 once). Create both apps in App Store Connect and Play Console with the bundle
   IDs above.
6. **Reviewer accounts.** Make a passenger account and a staff account (assigned to a
   test trip and hub) on production, with departures scheduled during the review
   window. Put the credentials in App Review notes and Play "App access".

## 3. Build and submit

```bash
cd apps/mobile
npx eas-cli build -p all --profile production         # ToGo
npx eas-cli build -p all --profile production-staff   # ToGo Staff
npx eas-cli submit -p ios --latest
npx eas-cli submit -p android --latest
```

Ship to TestFlight and a Play **internal testing** track first, and run the device
test below, before sending either app for review.

## 4. Store listing answers

**App Store privacy label ("App Privacy")**: Data linked to the user, used for App
Functionality only, not used for tracking:
- Contact info: name, email address, phone number
- Identifiers: user ID
- Other data: trip reservations
- ToGo Staff only, also: precise location (driver, while a trip is running)

**Google Play Data safety**: Collected: name, email, phone (optional), user IDs,
"other app activity" (reservations); Staff app also approximate/precise location. Not
shared with third parties for their own use; encrypted in transit; users can request
deletion (in-app, Account → Delete account).

**Content rating**: no objectionable content → 4+ (Apple) / Everyone (IARC).
**Category**: Travel (ToGo), Business (ToGo Staff).

**ToGo Staff and Apple.** An app only staff can sign in to may be rejected as an
internal tool (guideline 3.2). Options: publish it as an **Unlisted** app (request
through Apple), distribute through **Apple Business Manager**, or accept a public
listing with a reviewer account. On Google Play, use a closed testing track or
**Managed Google Play** for a private app.

## 5. Device test before submitting (real phones, production backend)

- [ ] Fresh install → welcome → onboarding → privacy link opens → Start travelling
- [ ] Create account, confirm email, sign in; reset password through the email link
- [ ] Reserve, view boarding pass; check-in shows "opens at …" until 2 h before pickup
- [ ] Driver starts the trip, location sharing turns on; passenger map shows the bus
- [ ] Conductor scans the QR (camera permission prompt), confirms boarding
- [ ] Attendant checks in by reference
- [ ] Delay and cancellation reach the passenger's alerts
- [ ] Cancel a reservation; seats are released
- [ ] Delete account; sign-in no longer works and the seats are released
- [ ] Deny location and camera: the app keeps working and explains what's missing
- [ ] Airplane mode: errors are readable and Retry works
- [ ] Larger text (Dynamic Type / font scale) and VoiceOver/TalkBack on the main screens

## 6. Known limits at launch

- Alerts are in-app only (no push notifications yet); the app says so.
- Location sharing runs only while the driver's trip screen is open.
- Payment is cash to the conductor; the app takes no payments.
