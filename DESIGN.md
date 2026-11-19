---
name: The Honeymoon
description: A private plan for two, set like a travel-house destination page.
colors:
  ink: "#222221"
  slate: "#43464b"
  olive: "#66665d"
  sand: "#bcb9af"
  stone: "#ebe9e6"
  stone-light: "#f5f4f1"
  rule: "#dedbd5"
  paper: "#ffffff"
  charcoal: "#262624"
  orange: "#f38b00"
  orange-hover: "#db7e08"
  orange-ink: "#a85a00"
  orange-wash: "#fdf3e6"
  ok: "#3e7a57"
  warn: "#b3412a"
typography:
  display:
    fontFamily: "Bebas Neue, Oswald, Arial Narrow, sans-serif"
    fontSize: "58px"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "0.14em"
  headline:
    fontFamily: "Bebas Neue, Oswald, Arial Narrow, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.14em"
  title:
    fontFamily: "Bebas Neue, Oswald, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.1em"
  figure:
    fontFamily: "Bebas Neue, Oswald, Arial Narrow, sans-serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.04em"
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-small:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  section-head:
    fontFamily: "Montserrat, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.26em"
  label:
    fontFamily: "Montserrat, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.16em"
  nav:
    fontFamily: "Montserrat, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    letterSpacing: "0.1em"
rounded:
  none: "0px"
spacing:
  gutter: "24px"
  gutter-mobile: "16px"
  max-width: "1120px"
  topbar: "64px"
  tabbar: "62px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "44px"
  button-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-orange:
    backgroundColor: "transparent"
    textColor: "{colors.orange-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "44px"
  button-orange-hover:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.ink}"
  button-fill:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "44px"
  button-fill-hover:
    backgroundColor: "{colors.orange-hover}"
    textColor: "{colors.ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.olive}"
    typography: "{typography.label}"
    padding: "0 10px"
    height: "44px"
  button-quiet-hover:
    textColor: "{colors.orange-ink}"
  button-small:
    padding: "0 14px"
    height: "36px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.olive}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "36px"
  chip-on-orange:
    backgroundColor: "{colors.orange-wash}"
    textColor: "{colors.orange-ink}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "9px 11px"
    height: "44px"
  subtab-strip:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "17px 30px"
  subtab-active:
    backgroundColor: "{colors.paper}"
  band-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sand}"
    typography: "{typography.label}"
    padding: "10px 24px"
  panel:
    backgroundColor: "{colors.stone-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "20px 22px 22px"
---

# Design System: The Honeymoon

## Overview

**Creative North Star: "The Destination Page"**

Every section of the plan reads like a page from a travel house's destination guide: a full-width photo band carrying a condensed, widely tracked title, a near-black caption strip of small tracked facts beneath it, a stone sub-tab strip, and then the working content on a white ground. The visual lineage is the Pelorus travel site and its printed proposals, translated into an operate app for two people on phones. Stand-in faces (Bebas Neue for the house's condensed display face, Source Serif 4 for its serif body) carry that voice from free sources.

The system is calm, flat and editorial. Structure comes from hairlines, tracked uppercase labels and a single warm orange that marks rules, dots, focus and hover. There are no rounded corners and almost no shadow; depth is the photo band against white, and stone fields against white. Density is moderate: lists and tables are hairline-ruled rather than boxed, so a day's travel, stay and plans fit within one or two thumbs of scrolling.

Interaction is quiet but alive, borrowed from the source site: links draw an orange underline in, buttons fill, band photos drift slowly closer on hover. The one deliberate departure from the source is contrast. Filled orange always carries ink text, never white, and orange used as text on white is the deeper burnt tone.

**Key Characteristics:**
- Photo band, dark caption strip, stone sub-tabs: the section opening, every time.
- White ground, ink text, one orange accent.
- Three voices: condensed display titles, tracked Montserrat labels (11px minimum), serif body.
- Square corners and 1px hairlines everywhere.
- Status is typographic: unboxed tracked labels with a dot or check, not pills.

## Colors

A warm-neutral, near-monochrome field (ink, slate, olive, sand, stone) with a single saturated orange doing all the signalling.

### Primary
- **Pelorus Orange** (orange): rules (the 2px top rule on panels, forms and toasts, the 3px rule on the sheet head, the active-nav underline), route dots and dashes, focus outlines, selection, meter fills, and the fill colour of buttons on hover. Never used as text on white.
- **Burnt Orange Ink** (orange-ink): the only orange allowed as text on white: outline-button labels, hover colour for links, quiet buttons and nav, "to book" tags, date lines under stop titles, and the "go" links on the home standing grid.
- **Deep Orange** (orange-hover): hover state of the filled submit button only.
- **Orange Wash** (orange-wash): today's row and calendar cell, and the "book ahead" chip when on.

### Neutral
- **Ink** (ink): body text, strong hairlines under section heads and table headers, the caption strip and cover ground, neutral button outlines and their hover fill, locked-option footers, toasts.
- **Charcoal Field** (charcoal): the photo band ground and the field behind the route of stops when a band has no photo.
- **Slate** (slate): the top-bar wordmark and secondary figures in the standing grid.
- **Olive** (olive): secondary text, meta lines, label text, inactive nav and tab-bar items, quiet buttons.
- **Sand** (sand): caption-strip text, cover sub-lines, past route dots, checkbox and input hover borders, the quiet panel rule.
- **Stone** (stone): sub-tab strips, meter and bar tracks.
- **Stone Light** (stone-light): panels, form wells, option footers and the hover fill for rows, days and calendar cells.
- **Rule** (rule): the default 1px hairline between rows, cards, cells and fields.
- **Paper** (paper): the ground, the active sub-tab block, inputs and cards.

### Semantic
- **Booked Green** (ok): booked chips, the synced dot, completed meters, pro markers.
- **Warning Red** (warn): book-by and key-booking tags, overdue dates, sync errors, budget overruns, the danger button.

### Named Rules
**The Ink-On-Orange Rule.** Any surface filled with orange carries ink text. White on orange is not used, even though the source site does it.

**The Two Oranges Rule.** Orange (`orange`) is for fills, rules, dots and focus; orange as text on white is always `orange-ink`.

**The One Accent Rule.** Orange is the only accent. Green and red are reserved for booked and warning states and never decorate.

## Typography

**Display Font:** Bebas Neue (with Oswald, Arial Narrow)
**Body Font:** Source Serif 4 (with Georgia, Times New Roman)
**Label Font:** Montserrat 500/600/700 (with Helvetica Neue, Arial)

**Character:** A condensed, widely tracked capital display face over a warm text serif, with Montserrat as the tracked uppercase voice of every label, button, tab and nav item. The display face states places and numbers; the serif carries everything a person reads.

### Hierarchy
- **Display** (400, 58px desktop / 40px mobile, 1.02, 0.14em, uppercase): photo band titles only. Compact list bands use 40px / 32px. The cover title is larger (clamp 46–76px, 0.26em).
- **Headline** (400, 34px, 1.05, 0.14em): stop titles; 26–28px for mini stop heads, month names and the sheet title.
- **Title** (400, 30px, 1.05, 0.1em, uppercase): panel titles.
- **Figure** (400, 30–40px, about 1, 0.03–0.04em, tabular): times, prices and money totals in the display face.
- **Body** (400, 16px, 1.6): all reading text; purpose lines cap at 62ch, notes at 70–78ch. Small body is 14–15px for meta and notes; 600 weight for item names.
- **Section Head** (600, 13px, 0.26em, uppercase): section headings above a strong ink hairline.
- **Label** (600, 11px, 0.1–0.22em, uppercase): buttons (0.22em), tags, caption strips, sub-tabs, table headers, field labels, dates.
- **Nav** (500, 12px, 0.1em, uppercase; 600 when active): desktop section nav.

### Named Rules
**The 11px Floor Rule.** No text renders below 11px, including tab-bar labels and calendar meta on small phones.

**The Tracked Caps Rule.** Every label, button and tab is Montserrat uppercase with positive tracking; the serif is never set in caps, and the display face is never set in sentence case.

## Layout

A centred column of 1120px max with 24px gutters (16px under 760px). Photo bands, caption strips and sub-tab strips run full width; content sits in the column below them. The top bar is 64px (54px mobile), sticky, white, with a three-column grid: sync state left, centred wordmark, settings and lock right; a centred tracked nav row sits under it on desktop. Under 760px the nav becomes a fixed five-item bottom bar (62px) with icons and labels, and an orange 2px bar over the active item.

Section rhythm: band, strip, sub-tabs, a centred purpose line (30px below), then section heads at 40px intervals, each ruled underneath in ink. Lists are hairline rows at 14–18px vertical padding. Grids: today is 7:5 two-column (single column under 960px); stay options auto-fill at 260px minimum; activities at 290px; the home standing and budget heads are four- and three-up grids divided by hairlines, dropping to two-up on mobile. Tables become stacked label/value blocks on mobile. The day bar sticks under the nav with a translucent white ground.

## Elevation & Depth

Flat. Depth comes from tone, not shadow: the charcoal photo band against white, stone strips and stone-light panels against white, and a bottom-weighted dark gradient over band photos so titles stay legible. The only cast shadow is the sheet, which floats over a 50% ink backdrop. Inset rules stand in for elevation elsewhere: today's row and calendar cell carry an orange inset top line; calendar cells carry a 3px inset top line in their stop colour.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 24px 64px rgba(25, 25, 25, .28)`): the booking and edit sheet only.
- **Now halo** (`box-shadow: 0 0 0 5px rgba(243, 139, 0, .25)`): the current stop's dot on a route.

### Named Rules
**The Flat Page Rule.** Cards, panels, buttons and inputs never cast shadows. A surface separates from the page with a hairline, a stone tone or an orange top rule.

## Shapes

Square everywhere (0px radius): buttons, chips, inputs, checkboxes, cards, panels, the sheet. The only circles are dots: route stops, status dots on tags, the sync dot, note dots. Borders are 1px hairlines in `rule`, strengthening to ink under section heads and table headers; accent rules are 2px orange on top edges (3px on the sheet head). Routes are drawn as a 1.5px dashed orange line between orange dots, with past stops greyed to sand. Icons are inline 24px-grid line SVGs at 1.6 stroke with round caps.

### Named Rules
**The Route Rule.** The dashed orange line of dots is the system's signature mark: it closes the cover, opens the home view and stands in for any band without a photo. It is always dashed, always orange, always dots of 10–13px.

## Components

### Buttons
Tracked uppercase labels in square outlines that fill on hover.
- **Shape:** square (0px), 1px border, 44px minimum height (36px small), 22px horizontal padding (14px small).
- **Neutral:** ink outline and ink text; fills ink with white text on hover.
- **Orange outline:** the in-page action ("Mark booked", "Lock in", "Add a stay"): orange border, burnt-orange text; fills orange with ink text on hover.
- **Fill:** form submits and the cover gate: orange fill, ink text; deepens to the hover orange.
- **Quiet:** secondary actions ("Edit", "Details"): no border, olive text, burnt-orange on hover, no fill.
- **Danger:** warning-red outline, filling red with white text on hover or when armed for a second press.
- **Motion:** colour, background and border transition over 150ms on `cubic-bezier(.4,0,.2,1)`. Disabled is 40% opacity.

### Chips
- **Style:** square toggles, 36px tall, 1px `rule` border, white ground, olive label text with a 14px line icon.
- **State:** hover shows an orange border and burnt-orange text; on is an ink border and ink text with the icon filled orange; "book ahead" on is orange border with orange wash; booked is solid green with white text; filter chips on are solid ink.

### Status tags
- **Style:** unboxed tracked labels, 11px, no border or background. Booked is ink text with a burnt-orange check; to book is burnt-orange text with a 6px orange dot; warnings are red text with a red dot; ideas are plain olive.

### Cards / Containers
- **Option card:** white, 1px `rule` border (sand on hover, ink when locked), 18px padding, a hairline-ruled price row in display figures, and a stone-light footer that turns ink with white text and an orange "Locked in" mark when locked.
- **Panel:** stone-light ground with a 2px orange top rule (sand when quiet), 20–22px padding, a display title and a tracked olive sub-line under it.
- **Shadow Strategy:** none (see Elevation & Depth).

### Inputs / Fields
- **Style:** 1px `rule` border, white, square, 44px minimum, 16px serif text; sand border on hover. Labels sit above in 11px tracked olive caps.
- **Focus:** orange border plus a 1px inset orange ring; no outline glow. Caret and native accents are orange.
- **Cover gate:** underline-only fields on the dark cover, the underline turning orange on focus.

### Navigation
- **Desktop:** centred tracked row, olive at rest, burnt orange on hover, ink and 600 weight when active with a 2px orange underline inset to the label width.
- **Mobile:** fixed bottom bar of five icon-plus-label items; active is ink with a burnt-orange icon and a 2px orange bar on the top edge.
- **Sub-tabs:** a full-width stone strip of tracked ink labels; the active tab is a white block, hover is burnt-orange text; counts follow in olive at 500 weight. Scrolls horizontally on phones.

### Photo Band (signature)
A charcoal section with a 320px photo (210px mobile; 150px compact), a bottom-up dark gradient, a centred display title, and an ink caption strip of sand tracked facts separated by mid-dots, with key facts in white. On hover the photo scales to 1.05 over 2s (ease-in-out) and a translucent "Add/Change photo" button appears top right, filling orange with ink text on hover. With no photo, the band shows the dashed orange route of stops instead; with neither, it shortens to 230px.

### Journey Ticket
A three-column row: a 36px square icon tile (solid ink for flights, hairline for other modes), the route in serif with an orange SVG arrow and a meta line, departure and arrival times in 36px display figures with tracked labels beneath, and a right column of status tags, price and actions.

### Sheet
A 640px square dialog with a 3px orange top rule and a display title, sliding up 14px and fading in over 220ms (from the bottom edge, 40px, on mobile) over a 50% ink backdrop.

### Links
A 1px `rule` underline at rest; on hover an orange underline draws in from the left over 0.5s and the text turns burnt orange. External links carry a small masked arrow.

## Do's and Don'ts

### Do:
- **Do** open every section with the photo band, the ink caption strip and the stone sub-tab strip, in that order.
- **Do** put ink text on any orange fill, and use `orange-ink` for orange text on white.
- **Do** set every label, button, tab and tag in Montserrat uppercase, tracked, at 11px or larger.
- **Do** separate content with 1px hairlines and orange 2px top rules rather than boxes and shadows.
- **Do** show times, prices and totals in the display face with tabular figures.
- **Do** use the dashed orange route of dots wherever a band has no photo.
- **Do** keep motion to the established set: 150ms state fills, 0.5s link draw, 2s band zoom, 220ms sheet entrance, all disabled under reduced motion.

### Don't:
- **Don't** put white text on orange.
- **Don't** round corners on any control, card, panel or sheet.
- **Don't** box status tags into pills or badges; they stay unboxed tracked labels.
- **Don't** add shadows to cards, panels, buttons or inputs; the sheet is the only floating surface.
- **Don't** introduce a second accent colour; green and red are for booked and warning only.
- **Don't** set body copy in the display face or the label face.
