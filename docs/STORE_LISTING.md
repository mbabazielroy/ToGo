# Store listings and review notes

Ready-to-paste text for App Store Connect and Google Play Console. Keep the claims in
step with what the app does: reviewers check them. Character limits are in brackets.

---

## ToGo (passengers): `app.togo.mobile`

**Name** [30]: `ToGo: Kampala–Mbarara Bus`
**Subtitle (iOS)** [30]: `Reserve, track and board`
**Short description (Play)** [80]: `Reserve a bus seat between Kampala and Mbarara, track your bus, board by scan.`
**Category:** Travel. **Age rating:** 4+ / Everyone.
**Keywords (iOS)** [100]: `bus,Kampala,Mbarara,Uganda,coach,ticket,seat,reserve,travel,transport,boarding,hub`

**Description** [4000]:

> ToGo makes travelling by bus between Kampala and Mbarara simple.
>
> RESERVE IN SECONDS
> Pick a departure, choose the pickup hub nearest you and hold your seats. You pay the operator's fare to the conductor when you board. There's no payment in the app.
>
> KNOW WHEN TO LEAVE
> See live countdowns to your pickup and get a reminder on your phone when check-in opens and when it's time to head to your hub. If your bus is delayed or changed, you'll see it in the app.
>
> FOLLOW YOUR BUS
> Watch your bus on the map as it travels the route, and find your nearest hub.
>
> BOARD WITH ONE SCAN
> Check in at your hub and show your boarding pass. The conductor scans it and you're on your way.
>
> YOUR DATA, YOUR CHOICE
> No ads, no tracking, and nothing sold. Delete your account any time from Account.

**What's new (1.0.0):** `First release.`

---

## ToGo Staff (crew and operations): `app.togo.staff`

**Name** [30]: `ToGo Staff`
**Subtitle (iOS)** [30]: `For ToGo crews and hubs`
**Short description (Play)** [80]: `For ToGo drivers, conductors and hub attendants: run trips and board passengers.`
**Category:** Business. **Age rating:** 4+ / Everyone.

**Description:**

> ToGo Staff is the work app for the drivers, conductors, hub attendants and operations teams who run ToGo departures. Accounts are issued by your operator.
>
> • Drivers: see who to pick up at each hub, start the trip, report delays, and share the bus's position with passengers while the trip runs.
> • Conductors: scan boarding passes and confirm passengers on board.
> • Hub attendants: check passengers in by reference and flag missed pickups.
> • Operations: schedule departures and assign crews.

**Distribution:** see "ToGo Staff and Apple" in `docs/STORE_LAUNCH.md`. Prefer Apple Business Manager (custom app) and Managed Google Play (private app); if you list it publicly, use the review notes below.

---

## App Review notes (App Store Connect → App Review Information)

Fill in the bracketed parts on the day you submit.

**ToGo**
```
ToGo lets passengers reserve seats on scheduled buses between Kampala and Mbarara
(Uganda). Fares are paid in cash to the conductor at boarding: the app takes no
payments (physical service, guideline 3.1.3(e) does not apply to in-app purchase).

Demo account: [passenger email] / [password]
The account has a reservation on a departure scheduled during the review window
([date, time EAT]). Check-in opens 2 hours before pickup.

Browsing departures and hubs works without signing in. Location is optional and
used only to show the nearest hub on the map; it stays on the device.
Account deletion: Account → Delete account.
```

**ToGo Staff**
```
ToGo Staff is the work app for bus crews (drivers, conductors, hub attendants) of
the ToGo passenger app. Accounts are created by the operator; there is no sign-up.

Demo account: [staff email] / [password] — assigned as driver and conductor on a
trip scheduled during the review window ([date, time EAT]).

Location: while the driver's trip is running and the app is open, the bus position
is shared with passengers of that trip (foreground only, no background location).
Camera: used by conductors to scan boarding QR codes; no images are stored.
```

## Google Play → App content

- **App access:** "All or some functionality is restricted" → the same demo accounts as above.
- **Ads:** No ads.
- **Data safety:** see `docs/STORE_LAUNCH.md` §4.
- **Account deletion URL:** `https://<your web domain>/legal/delete-account.html`
- **Privacy policy URL:** `https://<your web domain>/legal/privacy.html`
- **Target audience:** 13 and over (ToGo is not for children under 13).
- **Government app / financial features / health:** No.

## Screenshots needed

| Store | Size | Count |
|---|---|---|
| App Store, iPhone 6.9" | 1320 × 2868 (or 1290 × 2796) | 3–10 |
| Google Play, phone | 1080 × 1920 or larger, 9:16 | 2–8 |
| Google Play feature graphic | 1024 × 500 | 1 |

Suggested ToGo shots, in order: Home with the next-trip countdown → departure list → seat reservation → boarding pass with QR → live bus map. Take them from a production or preview build on a phone, not from the web preview.
