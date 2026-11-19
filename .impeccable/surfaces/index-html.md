---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["app.js","styles.css"]
---

# App shell (index.html + app.js views)

Mode: Operate. A phone-first planner for two people, used both before the trip and during it.

Jobs, in priority order: see today on the trip (stay, travel times, refs, plans); book things quickly (to-book → booked with ref and price); choose and lock stays; track budget and log spending in local currency.

Constraints: plain static site, no build step; the data model and sync/encryption stay as they are; no trip details in committed files (country photos and colours live in the encrypted data); routes #today #travel #stays #calendar #ideas #budget keep working as aliases.

Visual authority: pinned by the user to pelorustravel.com (the whole site, including its hover and animation behaviour) with the Pelorus proposal PDF as a secondary source. Translation: Pelorus fills buttons with white text on orange; here filled orange takes ink text for contrast, and orange text on white uses the deeper #A85A00.

## Direction contract

THESIS: The plan, presented like a Pelorus destination page. Each section is a photo band with a condensed title and a dark caption strip, followed by a stone sub-tab strip and then the content. This replaces the current mix of a dashboard, a wide table and a flat to-do list, which hides what each section is for.

OWN-WORLD: White ground; ink #222221; slate #43464B headings; olive #66665D for secondary text and nav; stone #EBE9E6 for strips and panels; orange #F38B00 for rules, dots, focus and hover fills (#A85A00 for orange text on white); dark caption strip #222221 with sand #BCB9AF text. Bebas Neue (standing in for MFred) for widely tracked condensed titles, Montserrat for tracked uppercase labels, buttons and nav, and Source Serif 4 (standing in for Berlingske) for body. Square corners, 1px rules, outline orange buttons that fill on hover in 150ms, links with an orange underline that draws in over 0.5s, photos that zoom to 1.05 over 2s on hover.

STORY: Five sections, each with a one-line purpose. Home: before the trip it answers "what's next to book"; during the trip it shows today. Itinerary: every day, with stays, travel and plans. Stays: compare and lock in where we sleep. Activities: ideas, shortlist and bookings. Budget: where the money stands, plus logging spending in local currency. Booking anything goes through one short sheet: ref, price, paid, times.

FIRST VIEWPORT: White top bar with the centred wordmark "THE HONEYMOON", the sync state on the left, settings and lock on the right; a centred tracked nav row on desktop and a five-item bottom bar on mobile. Below it, a full-width photo band (current or first country) with a condensed title and the dark caption strip (day N of M · place · nights left), then the stone sub-tab strip (Overview | Day by day). On the trip, "Tonight" and "Today's travel" with big times come straight after; before the trip, the "Next to book" list, grouped by urgency, with a "Mark booked" action on each row.

FORM: Pelorus destination-page grammar (photo card + dark caption strip + stone sub-tabs) applied to a standard app shell. Position on list: pinned, so there is no list. Seed key: none. The concept-seed roll was skipped because the user pinned the direction, in their words: "pull styling and design choices from https://pelorustravel.com/ and [the Pelorus proposal PDF] to keep the look and feel on brand", followed by "make sure to pull styles from all of the pelorus site, not just their home page, copy some of the hover behaviours and animations too". In the brand round they chose "Close to the website".

Cited adaptations: Home sub-tabs depend on the mode, "Planning | Day by day" before the trip and "Today | Trip overview" during it, serving the confirmed today-on-the-trip journey. Home's band title carries the countdown (or the day number) instead of repeating the wordmark. Without photos, bands show the dashed orange route of stops from the proposal cover.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
