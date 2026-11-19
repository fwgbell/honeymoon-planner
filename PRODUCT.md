# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two people: a couple planning and then taking their honeymoon. One of them set the app up and manages it. The other is less comfortable with tech and should never have to think about tokens, sync, repositories or encryption once their device is unlocked.

They use it in two settings:
- **Before the trip:** planning on laptops and phones. They compare and book travel and stays, shortlist activities and track the budget.
- **During the trip (primary):** on phones, often with poor or no signal. They check what's happening today, where they're staying, how they're getting there, and what's been booked or paid.

## Product Purpose

One shared place that holds the whole honeymoon plan: travel legs, stays, a day-by-day calendar, activity ideas, tasks and budget. It is private, works on both partners' devices and works offline. Success means neither of them has to dig through emails or booking sites during the trip, and both always see the same up-to-date plan.

## Positioning

A private plan for two, not a travel product. It's hosted publicly but holds only ciphertext, it unlocks with a single shared passphrase, and it is built around one specific trip rather than generic itinerary features.

## Operating Context

- Installed to the home screen as a PWA and opened on the **Today** view, which shows the current day of the trip, today's plans and what's next.
- Opened in transit, at check-in desks and on the street, often one-handed, sometimes offline.
- Edits from either device save automatically as encrypted commits and are merged record by record. Each device checks for the other's changes every minute.
- A travel company suggested some stays and options, and the app flags these.
- Money is planned in GBP, with planning exchange rates for local currencies. These are not live rates.

## Capabilities and Constraints

- Sections: Home (planning, or Today during the trip), Itinerary (days, calendar, journeys), Stays, Activities, Budget, plus Settings, a lock and a sync status. Old routes (#travel, #calendar, #ideas) redirect.
- Plain static HTML/CSS/JS (`index.html`, `app.js`, `store.js`, `styles.css`, `sw.js`). No build step, hosted on GitHub Pages, with a service worker for offline use.
- All data is AES-256-GCM encrypted under the passphrase. The passphrase can't be recovered. The app auto-locks after inactivity.
- Locale is en-GB.
- **The repo is public.** Nothing committed, including this file and any design docs, may contain trip destinations, dates, names, bookings or other identifying details. Mocks and screenshots must use placeholder data or stay in gitignored folders.
- No analytics, no third-party trackers, `noindex`, no referrer. External requests: Google Fonts, and the country header photos, which load from Wikimedia Commons with no referrer. Photo links and credits live in the encrypted data, never in committed files, and the service worker caches the photos for offline use. Creative Commons photos must show their credit line.

## Brand Commitments

- Name: "The Honeymoon" (short name "Honeymoon").
- Voice: warm, plain and calm. Security and setup copy is honest and direct, never alarming or full of jargon.

## Evidence on Hand

- Real trip data lives only in `private/seed.json` and the encrypted `data.enc.json`. Neither is a source for committed content.
- There are no testimonials or outside users, and none should be invented.

## Product Principles

1. **Today first.** During the trip, the most useful thing is what's happening now and next. Put it within one glance and one thumb.
2. **Invisible plumbing for the less technical partner.** Sync, tokens and encryption stay out of the way unless something needs attention, and then they're explained in plain words.
3. **Trust offline.** Show clearly what's saved, what's pending and what's stale, so the plan can be relied on without signal.
4. **Private by construction.** Never trade privacy for convenience. Nothing identifying is committed or sent anywhere.
5. **Made for two, made for this trip.** Prefer specific, personal touches over generic travel-app features.

## Accessibility & Inclusion

No specific needs were raised. Default to readable, high-contrast text and large touch targets, because the app is used outdoors, in bright sun and on the move.
