/* The Honeymoon planner: views, editing and sync orchestration. */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const COLS = ['legs', 'hotels', 'transport', 'activities', 'expenses', 'allocations', 'tasks', 'notes', 'countries'];
  const PALETTE = ['#c9925a', '#6f9465', '#4f9497', '#b0697e', '#7d7aa6', '#a58a4e'];
  const AIR_COLOR = '#8a877f';

  let D = null;
  const ui = {
    tab: 'today', sub: {}, expanded: {}, homeMode: null,
    day: null, showAllTodo: false, scrolledToday: false, sheetDay: null,
  };

  /* ---------------- Utilities ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { if (v === '' || v == null) return 0; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
  const money = (n) => `${n < 0 ? '−' : ''}£${Math.round(Math.abs(n)).toLocaleString('en-GB')}`;
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const lines = (s) => String(s || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || `${w}s`)}`;

  const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
  const isoOf = (d) => d.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const fmt = (iso, o) => (iso ? toDate(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o }) : '');
  const fDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  const fShort = (iso) => fmt(iso, { day: 'numeric', month: 'short' });
  const fLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  const fFull = (iso) => fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  function fRange(a, b) {
    const da = toDate(a), db = toDate(b);
    if (da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${fShort(b)}`;
    return `${fShort(a)} – ${fShort(b)}`;
  }
  function todayISO() {
    const p = new URLSearchParams(location.search).get('today');
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function toast(msg, ms = 2800) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  /* ---------------- Data helpers ---------------- */
  function normalize(d) {
    d = d || {};
    COLS.forEach((c) => { if (!Array.isArray(d[c])) d[c] = []; });
    d.deleted = d.deleted || {};
    d.meta = d.meta || {};
    d.meta.budgetCeiling = d.meta.budgetCeiling || 25000;
    d.meta.budgetPreferred = d.meta.budgetPreferred || 20000;
    d.meta.fx = d.meta.fx || { USD: 1.3, EUR: 1.15 };
    const legs = d.legs.slice().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    d.meta.start = d.meta.start || (legs[0] && legs[0].checkIn);
    d.meta.end = d.meta.end || (legs.length && legs[legs.length - 1].checkOut);
    return d;
  }

  function mergeData(local, remote) {
    const out = { ...remote, ...local };
    out.deleted = { ...(remote.deleted || {}) };
    Object.entries(local.deleted || {}).forEach(([k, v]) => { out.deleted[k] = Math.max(out.deleted[k] || 0, v); });
    COLS.forEach((c) => {
      const map = new Map(); const order = [];
      (remote[c] || []).forEach((r) => { map.set(r.id, r); order.push(r.id); });
      (local[c] || []).forEach((l) => {
        const r = map.get(l.id);
        if (!r) { map.set(l.id, l); order.push(l.id); } else if ((l.updatedAt || 0) >= (r.updatedAt || 0)) map.set(l.id, l);
      });
      out[c] = order.map((id) => map.get(id)).filter((x) => !(out.deleted[x.id] >= (x.updatedAt || 0)));
    });
    out.meta = ((local.meta && local.meta.updatedAt) || 0) >= ((remote.meta && remote.meta.updatedAt) || 0) ? local.meta : remote.meta;
    return normalize(out);
  }

  const touch = (r) => { r.updatedAt = Date.now(); return r; };
  const legs = () => D.legs.slice().sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const legById = (id) => D.legs.find((l) => l.id === id);
  const legFor = (date) => D.legs.find((l) => l.checkIn <= date && date < l.checkOut);
  const legsOf = (cid) => legs().filter((l) => l.country === cid);
  const nights = (l) => (l ? diffDays(l.checkIn, l.checkOut) : 0);
  const lockedHotel = (legId) => D.hotels.find((h) => h.legId === legId && h.locked);
  const hotelTotal = (h) => num(h.totalPrice) || num(h.pricePerNight) * nights(legById(h.legId));
  const country = (id) => D.countries.find((c) => c.id === id) || { id, name: id || 'Elsewhere' };
  function ccolor(id) {
    if (id === 'AIR') return AIR_COLOR;
    const i = D.countries.findIndex((c) => c.id === id);
    if (i < 0) return '';
    return D.countries[i].color || PALETTE[i % PALETTE.length];
  }
  function countrySpan(cid) {
    const ls = legsOf(cid);
    if (!ls.length) return null;
    return { start: ls[0].checkIn, end: ls.reduce((m, l) => (l.checkOut > m ? l.checkOut : m), '') };
  }
  const catLabel = (id) => (D.allocations.find((a) => a.id === id) || { label: id === 'OTHER' ? 'Other' : (id || 'Other') }).label;
  const tripDays = () => { const out = []; for (let d = D.meta.start; d <= D.meta.end; d = addDays(d, 1)) out.push(d); return out; };
  const byTime = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.depTime || a.time || '99').localeCompare(b.depTime || b.time || '99');
  const transportOn = (date) => D.transport.filter((t) => t.date === date || (t.arrDate && t.arrDate === date && t.date !== date)).sort(byTime);
  const activitiesOn = (date) => D.activities.filter((a) => a.date === date).sort(byTime);
  const noteFor = (date) => D.notes.find((n) => n.id === `N-${date}`);
  const isBooked = (a) => a.status === 'booked';
  const overnightFlight = (date) => D.transport.find((t) => t.date === date && t.arrDate && t.arrDate > t.date);
  function dayCountry(date) {
    const l = legFor(date);
    if (l) return l.country;
    return overnightFlight(date) ? 'AIR' : '';
  }
  function code(s) { const m = String(s || '').match(/\(([A-Z]{3})\)/); return m ? m[1] : String(s || '').split(/\s*[,(/]/)[0].trim(); }
  const tripState = () => { const t = todayISO(); return { t, inTrip: t >= D.meta.start && t <= D.meta.end, before: t < D.meta.start, after: t > D.meta.end }; };
  function focusCountry(slot = 0) {
    const { t, inTrip } = tripState();
    const c = inTrip ? dayCountry(t) : '';
    if (c && c !== 'AIR') return country(c);
    const n = D.countries.length;
    return n ? D.countries[slot % n] : null;
  }

  function budgetItems() {
    const items = [];
    D.hotels.filter((h) => h.locked).forEach((h) => {
      const l = legById(h.legId);
      items.push({ cat: l ? l.country : 'OTHER', label: `${h.name}${l ? ` · ${l.place}` : ''}`, amount: hotelTotal(h), paid: num(h.paid) });
    });
    D.transport.forEach((t) => {
      if (num(t.price) || num(t.paid)) items.push({ cat: t.budgetCat || 'FLIGHTS', label: `${t.from} → ${t.to}`, amount: num(t.price), paid: num(t.paid) });
    });
    D.activities.forEach((a) => {
      if (isBooked(a) || num(a.paid)) items.push({ cat: (legById(a.legId) || {}).country || 'OTHER', label: a.title, amount: isBooked(a) ? num(a.cost) : 0, paid: num(a.paid) });
    });
    D.expenses.forEach((e) => items.push({ cat: e.category || 'OTHER', label: e.label, amount: num(e.amount), paid: num(e.paid) }));
    items.forEach((i) => { i.amount = Math.max(i.amount, i.paid); });
    return items;
  }

  function todoItems() {
    const out = [];
    D.activities.filter((a) => a.needsBookingAhead && !isBooked(a)).forEach((a) => {
      const l = legById(a.legId);
      out.push({ col: 'activities', id: a.id, title: a.title, sub: l ? l.place : '', when: a.bookBy || a.date || (l && l.checkIn), bookBy: a.bookBy, priority: !!a.priority, kind: 'Activity' });
    });
    D.transport.filter((t) => t.status !== 'booked').forEach((t) => {
      out.push({ col: 'transport', id: t.id, title: `${t.from} → ${t.to}`, sub: t.carrier || '', when: t.bookBy || t.date, bookBy: t.bookBy, priority: t.mode === 'flight', kind: t.mode === 'flight' ? 'Flight' : 'Travel' });
    });
    legs().filter((l) => !lockedHotel(l.id)).forEach((l) => {
      out.push({ stay: true, id: l.id, title: `Choose a hotel in ${l.place}`, sub: `${fRange(l.checkIn, l.checkOut)} · ${plural(nights(l), 'night')}`, when: l.checkIn, priority: !!l.priority, kind: 'Stay' });
    });
    return out.sort((a, b) => (b.priority - a.priority) || ((a.bookBy ? 0 : 1) - (b.bookBy ? 0 : 1)) || (a.when || '').localeCompare(b.when || ''));
  }

  /* ---------------- Sync ---------------- */
  let dirty = false, saving = false, saveTimer = null, lastError = null, retryTimer = null;

  function commit() {
    if (!Store.canWrite) { toast('Read-only on this device. Add a GitHub token in Settings to save changes.', 4500); return; }
    dirty = true; lastError = null; setSync();
    clearTimeout(saveTimer); saveTimer = setTimeout(flush, 1500);
  }

  async function flush() {
    if (saving || !dirty || !D) return;
    if (!Store.canWrite) { setSync(); return; }
    saving = true; dirty = false; setSync();
    try {
      const res = await Store.save(D, mergeData);
      if (res !== D) { D = mergeData(D, res); safeRender(); }
      lastError = null;
    } catch (e) {
      dirty = true; lastError = e;
      if (e.code === 'auth') toast('GitHub token rejected. Update it in Settings.', 5000);
      else if (e.code === 'rekeyed') toast(e.message, 6000);
      clearTimeout(retryTimer); retryTimer = setTimeout(flush, 20000);
    }
    saving = false; setSync();
    if (dirty && !lastError) { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 800); }
  }

  async function pull(quiet = true) {
    if (!Store.token || saving || !D) return;
    try {
      const remote = await Store.pull();
      if (remote) { D = mergeData(D, normalize(remote)); safeRender(); if (!quiet) toast('Updated with the latest changes'); }
      else if (!quiet) toast('Already up to date');
      lastError = null;
    } catch (e) {
      lastError = e;
      if (!quiet || e.code === 'rekeyed' || e.code === 'auth') toast(e.message, 5000);
    }
    setSync();
  }

  function syncState() {
    if (!Store.canWrite) return { txt: 'Read-only', cls: '', tip: 'This device can read the plan but not change it. Add a GitHub token in Settings to make changes.' };
    if (saving) return { txt: 'Saving', cls: 'busy', tip: 'Encrypting and saving your changes…' };
    if (lastError) return { txt: navigator.onLine ? 'Not saved' : 'Offline', cls: 'err', tip: navigator.onLine ? `Changes not saved yet: ${lastError.message}` : "You're offline. Changes will save when you're back online, as long as this page stays open." };
    if (dirty) return { txt: 'Unsaved', cls: 'busy', tip: 'Changes will save in a moment.' };
    if (Store.localMode) return { txt: 'Local test', cls: 'busy', tip: 'Local test mode: changes are saved in this browser only.' };
    return { txt: 'Saved', cls: 'ok', tip: 'All changes are encrypted and saved.' };
  }
  function setSync() {
    const c = $('#syncChip'); if (!c) return;
    const s = syncState();
    c.className = `sync ${s.cls}`;
    $('.sync-label', c).textContent = s.txt;
    c.title = s.tip;
    c.setAttribute('aria-label', `Sync status: ${s.txt}`);
  }

  /* ---------------- Icons ---------------- */
  const ICON = {
    flight: '<svg viewBox="0 0 24 24"><path d="M2.5 13.5 21 6l-4 13-4.5-5-4 3v-5z"/><path d="m12.5 14 8.5-8"/></svg>',
    rail: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/></svg>',
    road: '<svg viewBox="0 0 24 24"><path d="M4 16v-4l2-5h12l2 5v4z"/><path d="M4 12h16"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>',
    ferry: '<svg viewBox="0 0 24 24"><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 14l1-5h12l1 5M9 9V5h6v4"/></svg>',
    other: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg class="arrow" viewBox="0 0 18 10"><path d="M1 5h15M12 1l4 4-4 4"/></svg>',
    to: '<svg class="to" viewBox="0 0 28 12"><path d="M1 6h25M21 1l5 5-5 5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/></svg>',
    dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg>',
    pound: '<svg viewBox="0 0 24 24"><path d="M16.5 6.5A4.5 4.5 0 0 0 8.5 9v10.5H17M6.5 14h8"/></svg>',
  };
  ICON.transfer = ICON.road;
  const modeIcon = (m) => ICON[m] || ICON.other;

  /* ---------------- Shared fragments ---------------- */
  function bandHTML({ title, strip, ctry, stops, compact, level = 1 }) {
    const img = ctry && safeUrl(ctry.image);
    const t = todayISO();
    const route = !img && stops && stops.length
      ? `<div class="band-route ${stops.length > 5 ? 'many' : ''}">${stops.map((s) => `<span class="${t >= s.end ? 'past' : t >= s.start ? 'now' : ''}"><em>${esc(String(s.label).split(/\s+\/\s+|,\s+/)[0])}</em></span>`).join('')}</div>`
      : '';
    const btn = ctry && ctry.id && D.countries.some((c) => c.id === ctry.id)
      ? `<button type="button" class="band-photo-btn" data-act="edit" data-col="countries" data-id="${esc(ctry.id)}">${ICON.camera}<span class="t">${img ? 'Change photo' : 'Add photo'}</span></button>` : '';
    const h = level === 1 ? 'h1' : 'h2';
    return `<section class="${compact ? 'cband' : 'band'} ${img ? '' : 'no-photo'} ${!img && !route ? 'bare' : ''}" style="--cc:${ccolor(ctry && ctry.id) || 'var(--orange)'}">
      <div class="band-media">
        ${img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer" decoding="async" onerror="this.remove()">${ctry.imageCredit ? `<span class="band-credit">${esc(ctry.imageCredit)}</span>` : ''}` : ''}
        ${route}
        <${h} class="band-title">${esc(title)}</${h}>
        ${btn}
      </div>
      <div class="band-strip">${String(strip).split(SEP).filter((x) => x.trim()).map((x) => (x.includes('class="nw"') ? x : `<span class="nw">${x}</span>`)).join(SEP)}</div>
    </section>`;
  }
  const SEP = '<span class="sep">·</span><wbr>';
  const countryStops = () => D.countries.map((c) => { const s = countrySpan(c.id); return s ? { label: c.name, start: s.start, end: s.end } : null; }).filter(Boolean);
  const legStops = (cid) => legsOf(cid).map((l) => ({ label: l.place, start: l.checkIn, end: l.checkOut }));

  function subtabsHTML(items, current, tab, label) {
    return `<nav class="subtabs" aria-label="${esc(label)}"><div class="subtabs-inner">${items.map(([v, l, count]) => `<button type="button" class="${v === current ? 'on' : ''}" aria-current="${v === current ? 'page' : 'false'}" data-act="sub" data-tab="${tab}" data-v="${esc(v)}">${esc(l)}${count != null ? `<span class="count">${esc(count)}</span>` : ''}</button>`).join('')}</div></nav>`;
  }

  function statusTag(s) {
    if (s === 'booked') return `<span class="tag tag-ok">${ICON.check}Booked</span>`;
    if (s === 'to-book') return '<span class="tag tag-todo">To book</span>';
    return '<span class="tag">Idea</span>';
  }

  function ticketHTML(t, opts = {}) {
    const links = [t.link, t.link2].map(safeUrl).filter(Boolean);
    const arriving = opts.date && t.arrDate === opts.date && t.date !== opts.date;
    const booked = t.status === 'booked';
    const depK = `Departs${t.depTerminal ? ` · ${esc(t.depTerminal)}` : ''}`;
    const arrK = `Arrives${t.arrDate && t.arrDate !== t.date ? ` ${fShort(t.arrDate)}` : ''}${t.arrTerminal ? ` · ${esc(t.arrTerminal)}` : ''}`;
    const meta = [esc(t.carrier || ''), t.number ? `<b>${esc(t.number)}</b>` : '', t.bookingRef ? `Ref <span class="ref">${esc(t.bookingRef)}</span>` : ''].filter(Boolean).join(' · ');
    return `<div class="ticket ${esc(t.mode)}">
      <div class="ico" aria-hidden="true">${modeIcon(t.mode)}</div>
      <div>
        <div class="troute">${arriving ? '<span class="tag">Arriving today</span> ' : ''}${esc(t.from)}${ICON.arrow}${esc(t.to)}</div>
        ${meta ? `<div class="tmeta">${meta}</div>` : ''}
        ${t.depTime || t.arrTime ? `<div class="ttimes">
          <div class="ttime"><div class="t">${esc(t.depTime || '—')}</div><div class="k">${depK}</div></div>
          ${ICON.to}
          <div class="ttime"><div class="t">${esc(t.arrTime || '—')}</div><div class="k">${arrK}</div></div>
        </div>` : `<div class="notime">${booked ? 'Add the times when you have them' : 'Times not set yet'}</div>`}
        ${t.seats || t.bags ? `<div class="tmeta">${t.seats ? `Seats ${esc(t.seats)}` : ''}${t.seats && t.bags ? ' · ' : ''}${t.bags ? `Bags ${esc(t.bags)}` : ''}</div>` : ''}
        ${t.notes && !opts.compact ? `<div class="tnotes">${esc(t.notes)}</div>` : ''}
        ${links.length && !opts.compact ? `<div class="tlinks">${links.map((u, i) => `<a class="lnk lnk-ext" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${i ? 'More info' : 'Book or check'}</a>`).join('')}</div>` : ''}
      </div>
      <div class="tside">
        ${statusTag(t.status)}
        ${t.bookBy && !booked ? `<span class="tag tag-warn">Book by ${fShort(t.bookBy)}</span>` : ''}
        ${num(t.price) ? `<span class="price small">${money(num(t.price))}${num(t.paid) ? ` <span class="muted">· paid ${money(num(t.paid))}</span>` : ''}</span>` : ''}
        <div class="btn-row">
          ${booked ? '' : `<button class="btn btn-sm btn-orange" data-act="book" data-col="transport" data-id="${t.id}">Mark booked</button>`}
          <button class="btn btn-sm btn-quiet" data-act="edit" data-col="transport" data-id="${t.id}">${booked ? 'Edit details' : 'Edit'}</button>
        </div>
      </div>
    </div>`;
  }

  function planRow(a) {
    const u = safeUrl(a.url);
    return `<li>
      <input type="checkbox" class="check" data-act="act-booked" data-id="${a.id}" ${isBooked(a) ? 'checked' : ''} aria-label="Booked: ${esc(a.title)}">
      <div class="grow">
        <div class="title">${a.time ? `<b class="num">${esc(a.time)}</b> · ` : ''}${u ? `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : esc(a.title)}</div>
        ${a.bookingRef || a.notes ? `<div class="meta">${a.bookingRef ? `Ref <span class="ref">${esc(a.bookingRef)}</span>${a.notes ? ' · ' : ''}` : ''}${esc(a.notes || '')}</div>` : ''}
      </div>
      <div class="acts"><button class="btn btn-sm btn-quiet" data-act="edit" data-col="activities" data-id="${a.id}">Edit</button></div>
    </li>`;
  }

  function tonightHTML(date) {
    const leg = legFor(date);
    const out = D.legs.find((l) => l.checkOut === date && (!leg || l.id !== leg.id));
    const outLine = out ? `<p class="small muted">Check out of ${esc((lockedHotel(out.id) || {}).name || out.place)} this morning.</p>` : '';
    if (!leg) {
      const ovf = overnightFlight(date);
      return `<div class="panel quiet">
        <h3 class="panel-title">${ovf ? 'Overnight flight' : 'No stay planned'}</h3>
        <p class="panel-sub">${ovf ? `${esc(ovf.from)} → ${esc(ovf.to)}` : 'Tonight'}</p>
        ${outLine}
        ${!ovf ? '<div class="btn-row"><button class="btn btn-sm btn-orange" data-act="add" data-col="legs">Add a stay</button></div>' : ''}
      </div>`;
    }
    const h = lockedHotel(leg.id);
    const h0 = h;
    const sub = `${esc(leg.place)}${h0 && h0.category ? ` · ${esc(h0.category)}` : ''}`;
    if (!h) {
      return `<div class="panel">
        <h3 class="panel-title">Hotel not chosen yet</h3>
        <p class="panel-sub">${sub}</p>
        ${outLine}
        ${leg.notes ? `<p class="small muted">${esc(leg.notes)}</p>` : ''}
        <div class="btn-row"><button class="btn btn-sm btn-orange" data-act="goto-leg" data-leg="${leg.id}">Compare and choose</button></div>
      </div>`;
    }
    const u = safeUrl(h.url);
    const maps = h.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}` : '';
    const tel = h.phone ? `tel:${h.phone.replace(/[^+\d]/g, '')}` : '';
    return `<div class="panel">
      <h3 class="panel-title">${u ? `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(h.name)}</a>` : esc(h.name)}</h3>
      <p class="panel-sub">${sub}</p>
      ${outLine}
      <dl class="kv">
        ${h.bookingRef ? `<dt>Booking ref</dt><dd><span class="ref">${esc(h.bookingRef)}</span></dd>` : '<dt>Booking ref</dt><dd class="muted">Not added yet</dd>'}
        ${h.checkInTime ? `<dt>Check-in</dt><dd>${esc(h.checkInTime)}</dd>` : ''}
        ${h.address ? `<dt>Address</dt><dd>${esc(h.address)}</dd>` : ''}
        ${h.phone ? `<dt>Phone</dt><dd><a class="lnk" href="${esc(tel)}">${esc(h.phone)}</a></dd>` : ''}
        ${h.cancelBy ? `<dt>Free cancel</dt><dd>Until ${fDay(h.cancelBy)}</dd>` : ''}
      </dl>
      <div class="btn-row">
        ${maps ? `<a class="btn btn-sm btn-orange" href="${esc(maps)}" target="_blank" rel="noopener noreferrer">${ICON.pin}Directions</a>` : ''}
        ${tel ? `<a class="btn btn-sm btn-orange" href="${esc(tel)}">${ICON.phone}Call</a>` : ''}
        <button class="btn btn-sm btn-quiet" data-act="book" data-col="hotels" data-id="${h.id}">${h.bookingRef || h.address ? 'Edit booking' : 'Add booking details'}</button>
      </div>
    </div>`;
  }

  function dayBody(date, inSheet) {
    const trs = transportOn(date);
    const acts = activitiesOn(date);
    const note = noteFor(date);
    const leg = legFor(date);
    let next = '';
    if (!trs.length) {
      const n = D.transport.filter((x) => x.date > date).sort(byTime)[0];
      if (n) next = `<p class="small muted" style="margin-top:12px">Next travel: <button class="btn btn-sm btn-quiet" style="padding:0" data-act="${inSheet ? 'open-day' : 'goto-day'}" data-date="${n.date}">${fDay(n.date)} · ${esc(code(n.from))} → ${esc(code(n.to))}</button></p>`;
    }
    const tom = addDays(date, 1);
    const tomLeg = legFor(tom);
    const tomTr = transportOn(tom);
    const tomActs = activitiesOn(tom);
    const tomorrow = tom <= D.meta.end ? `
      <div class="sh"><h3>Tomorrow · ${fDay(tom)}</h3><div class="btn-row"><button class="btn btn-sm btn-quiet" data-act="${inSheet ? 'open-day' : 'day'}" data-delta="1" data-date="${tom}">See the day</button></div></div>
      <ul class="rows plain">
        ${tomLeg && (!leg || tomLeg.id !== leg.id) ? `<li><div class="grow"><div class="title">Moving to ${esc(tomLeg.place)}</div><div class="meta">${esc((lockedHotel(tomLeg.id) || {}).name || 'Hotel not chosen yet')}</div></div></li>` : ''}
        ${tomTr.map((x) => `<li><div class="grow"><div class="title">${x.depTime ? `<b class="num">${esc(x.depTime)}</b> · ` : ''}${esc(x.from)} → ${esc(x.to)}</div><div class="meta">${esc(x.carrier || '')}${x.status === 'booked' ? ' · Booked' : ' · Not booked yet'}</div></div></li>`).join('')}
        ${tomActs.map((a) => `<li><div class="grow"><div class="title">${a.time ? `<b class="num">${esc(a.time)}</b> · ` : ''}${esc(a.title)}</div></div></li>`).join('')}
        ${!tomTr.length && !tomActs.length && !(tomLeg && (!leg || tomLeg.id !== leg.id)) ? '<li class="empty">A free day.</li>' : ''}
      </ul>` : '';

    const leg0 = legFor(date);
    return `
      <div class="sh"><h3>Tonight</h3>${leg0 ? `<span class="sh-meta">Night ${diffDays(leg0.checkIn, date) + 1} of ${nights(leg0)} · Check out ${fDay(leg0.checkOut)}</span>` : ''}</div>
      ${tonightHTML(date)}
      <div class="day-actions"><button class="btn btn-sm btn-orange" data-act="spend" data-date="${date}" data-cat="${leg ? leg.country : ''}">${ICON.pound}Log spending</button><span class="small muted">Any currency; it converts to pounds.</span></div>
      <div class="day-grid">
        <div>
          <div class="sh"><h3>Travel</h3><div class="btn-row"><button class="btn btn-sm btn-quiet" data-act="add" data-col="transport" data-date="${date}">${ICON.plus}Add travel</button></div></div>
          ${trs.length ? `<div class="tickets">${trs.map((x) => ticketHTML(x, { date, compact: inSheet })).join('')}</div>` : `<p class="empty">No travel today.</p>${next}`}
        </div>
        <div>
          <div class="sh"><h3>Plans</h3><div class="btn-row"><button class="btn btn-sm btn-quiet" data-act="add" data-col="activities" data-date="${date}" data-leg="${leg ? leg.id : ''}">${ICON.plus}Add plan</button></div></div>
          ${acts.length ? `<ul class="rows">${acts.map(planRow).join('')}</ul>` : '<p class="empty">Nothing planned. A free day.</p>'}
        </div>
      </div>
      <div class="day-grid">
        <div>
          <div class="sh"><h3>Notes</h3></div>
          <textarea class="note-area" data-note="${date}" rows="4" placeholder="Restaurant ideas, reminders, things to remember…" aria-label="Notes for ${esc(fLong(date))}">${esc(note ? note.text : '')}</textarea>
          <div class="note-state" data-note-state="${date}">${note && note.text ? 'Saved' : 'Saves as you type'}</div>
        </div>
        <div>${tomorrow}</div>
      </div>`;
  }

  /* ---------------- Views ---------------- */
  function viewToday() {
    const { t, inTrip, after } = tripState();
    const { start, end } = D.meta;
    const mode = ui.homeMode || (inTrip ? 'day' : 'plan');
    const tabs = inTrip ? [['day', 'Today'], ['plan', 'Trip overview']] : [['plan', after ? 'Overview' : 'Planning'], ['day', 'Day by day']];
    const sub = subtabsHTML(tabs, mode, 'today', 'Home view');

    if (mode === 'day') {
      const day = ui.day || (inTrip ? t : start);
      ui.day = day;
      const leg = legFor(day);
      const c = leg ? country(leg.country) : null;
      const n = diffDays(start, day) + 1, total = diffDays(start, end) + 1;
      const title = leg ? leg.place : (overnightFlight(day) ? 'In the air' : 'Travelling');
      return `
        ${bandHTML({ title, ctry: c, stops: c ? legStops(c.id) : countryStops(), strip: `<b>Day ${n} of ${total}</b>${SEP}${esc(fLong(day))}${c ? `${SEP}${esc(c.name)}` : ''}` })}
        ${sub}
        <div class="daybar"><div class="daybar-inner">
          <button class="btn btn-sm btn-quiet" data-act="day" data-delta="-1" ${day <= start ? 'disabled' : ''} aria-label="Previous day">${ICON.left}Prev</button>
          <div class="d">${esc(fDay(day))}${day === t ? ' <span>· Today</span>' : ''}</div>
          ${day !== t && inTrip ? '<button class="btn btn-sm btn-orange" data-act="day-today">Today</button>' : ''}
          <button class="btn btn-sm btn-quiet" data-act="day" data-delta="1" ${day >= end ? 'disabled' : ''} aria-label="Next day">Next${ICON.right}</button>
        </div></div>
        <div class="wrap">${dayBody(day, false)}</div>`;
    }

    const items = budgetItems();
    const paid = items.reduce((s, i) => s + i.paid, 0);
    const committed = items.reduce((s, i) => s + i.amount, 0);
    const ceil = num(D.meta.budgetCeiling);
    const daysLeft = diffDays(t, start);
    const ls = legs();
    const locked = ls.filter((l) => lockedHotel(l.id)).length;
    const trN = D.transport.length, trB = D.transport.filter((x) => x.status === 'booked').length;
    const actNeed = D.activities.filter((a) => a.needsBookingAhead && !isBooked(a)).length;
    const actB = D.activities.filter(isBooked).length;
    const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

    const todo = todoItems();
    const soon = addDays(t, 30);
    const groups = [
      ['Book-by date soon', todo.filter((i) => i.bookBy && i.bookBy <= soon), 'warn'],
      ['Key bookings', todo.filter((i) => !(i.bookBy && i.bookBy <= soon) && i.priority), ''],
      ['Everything else', todo.filter((i) => !(i.bookBy && i.bookBy <= soon) && !i.priority).sort((a, b) => (a.when || '').localeCompare(b.when || '')), ''],
    ];
    const row = (i) => `<li>
      <span class="when ${i.bookBy && i.bookBy < t ? 'due' : ''}">${i.bookBy ? `By ${fShort(i.bookBy)}` : i.when ? fShort(i.when) : ''}</span>
      <div class="grow"><div class="title">${esc(i.title)}</div><div class="meta">${esc(i.kind)}${i.sub ? ` · ${esc(i.sub)}` : ''}</div></div>
      <div class="acts">${i.stay
        ? `<button class="btn btn-sm btn-orange" data-act="goto-leg" data-leg="${i.id}">Compare stays</button><span></span>`
        : `<button class="btn btn-sm btn-orange" data-act="book" data-col="${i.col}" data-id="${i.id}">Mark booked</button><button class="btn btn-sm btn-quiet" data-act="edit" data-col="${i.col}" data-id="${i.id}">Details</button>`}</div>
    </li>`;
    let shownCount = 0;
    const LIMIT = 8;
    const todoHTML = groups.map(([label, list, cls], gi) => {
      if (!list.length) return '';
      let shown = list;
      if (gi === 2 && !ui.showAllTodo) shown = list.slice(0, Math.max(4, LIMIT - shownCount));
      shownCount += shown.length;
      const hidden = list.length - shown.length;
      return `<div class="group-label ${cls}"><span>${esc(label)}</span><span class="n">· ${list.length}</span></div>
        <ul class="rows book-list">${shown.map(row).join('')}</ul>
        ${hidden > 0 ? `<div class="btn-row" style="margin-top:12px"><button class="btn btn-sm" data-act="todo-all">Show ${hidden} more</button></div>` : ''}`;
    }).join('') || '<p class="empty">Everything is booked. Enjoy it.</p>';

    const tasks = D.tasks;
    const done = tasks.filter((k) => k.done).length;
    const fc = focusCountry();

    return `
      ${bandHTML({ title: after ? 'Welcome home' : inTrip ? `Day ${diffDays(start, t) + 1} of ${diffDays(start, end) + 1}` : `${plural(daysLeft, 'day')} to go`, ctry: fc, stops: countryStops(), strip: `<span class="nw">${esc(fFull(start))} – ${esc(fFull(end))}</span>${SEP}${D.countries.map((c) => `<span class="nw">${esc(c.name)}</span>`).join(SEP)}` })}
      ${sub}
      <div class="wrap">
        <p class="purpose">${inTrip ? 'The whole plan at a glance. Switch to Today for tonight’s hotel, today’s travel and plans.' : 'What’s still to book, most urgent first. Mark things booked here as you go: the details appear on the day they happen and in the budget.'}</p>

        <div class="sh"><h2>Next to book</h2><span class="sh-meta">${plural(todo.length, 'thing')} left</span></div>
        ${todoHTML}

        <div class="sh"><h2>Where the plan stands</h2></div>
        <div class="standing">
          <a href="#stays"><span class="k">Stays</span><span class="v"><b>${locked}</b>of ${ls.length} locked in</span><span class="meter"><span class="${locked === ls.length ? 'done' : ''}" style="width:${pct(locked, ls.length)}%"></span></span><span class="go">Compare stays</span></a>
          <a href="#itinerary/journeys"><span class="k">Travel</span><span class="v"><b>${trB}</b>of ${trN} booked</span><span class="meter"><span class="${trB === trN ? 'done' : ''}" style="width:${pct(trB, trN)}%"></span></span><span class="go">See journeys</span></a>
          <a href="#activities/need"><span class="k">Activities</span><span class="v"><b>${actNeed}</b>to book ahead · ${actB} booked</span><span class="meter"><span style="width:${pct(actB, actB + actNeed)}%"></span></span><span class="go">See activities</span></a>
          <a href="#budget"><span class="k">Budget</span><span class="v"><b>${money(committed)}</b>of ${money(ceil)}</span><span class="meter"><span style="width:${pct(committed, ceil)}%"></span></span><span class="go">${money(paid)} paid so far</span></a>
        </div>

        <div class="sh"><h2>Before you travel</h2><span class="sh-meta">${done} of ${tasks.length} done</span></div>
        <ul class="rows">${tasks.slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)).map((k) => `
          <li>
            <input type="checkbox" class="check" data-act="task" data-id="${k.id}" ${k.done ? 'checked' : ''} aria-label="Done">
            <div class="grow"><div class="title ${k.done ? 'done-text' : ''}">${safeUrl(k.url) ? `<a class="lnk" href="${esc(k.url)}" target="_blank" rel="noopener noreferrer">${esc(k.title)}</a>` : esc(k.title)}</div></div>
            <div class="acts"><button class="btn btn-sm btn-quiet" data-act="edit" data-col="tasks" data-id="${k.id}">Edit</button></div>
          </li>`).join('') || '<li class="empty">No tasks yet.</li>'}
        </ul>
        <div class="btn-row" style="margin-top:14px"><button class="btn btn-sm" data-act="add" data-col="tasks">${ICON.plus}Add task</button></div>
      </div>`;
  }

  function evList(d) {
    const out = [];
    transportOn(d).forEach((x) => out.push({ cls: 'tr', icon: modeIcon(x.mode), txt: `${x.date === d ? (x.depTime ? `${x.depTime} ` : '') : 'Arrive '}${code(x.from)} → ${code(x.to)}` }));
    activitiesOn(d).forEach((a) => out.push({ cls: isBooked(a) ? 'bk' : '', icon: isBooked(a) ? ICON.check : ICON.dot, txt: `${a.time ? `${a.time} ` : ''}${a.title}` }));
    return out;
  }

  function viewItinerary() {
    const sub = ui.sub.itinerary || 'days';
    const { t } = tripState();
    const { start, end } = D.meta;
    const head = `
      ${bandHTML({ title: 'Itinerary', ctry: focusCountry(1), stops: countryStops(), strip: `${esc(fFull(start))} – ${esc(fFull(end))}${SEP}${plural(diffDays(start, end) + 1, 'day')}${SEP}${plural(D.legs.length, 'stop')}` })}
      ${subtabsHTML([['days', 'Day by day'], ['calendar', 'Calendar'], ['journeys', 'Journeys', `${D.transport.filter((x) => x.status === 'booked').length}/${D.transport.length}`]], sub, 'itinerary', 'Itinerary view')}`;

    if (sub === 'journeys') return head + journeysHTML();
    if (sub === 'calendar') return head + calendarHTML(t);

    let current = null;
    let html = '';
    tripDays().forEach((d) => {
      const l = legFor(d);
      const key = l ? l.country : null;
      if (key && key !== current) {
        current = key;
        const c = country(key);
        const span = countrySpan(key);
        const ls = legsOf(key);
        html += bandHTML({ title: c.name, ctry: c, stops: legStops(key), compact: true, level: 2, strip: `${span ? esc(fRange(span.start, span.end)) : ''}${SEP}${plural(ls.reduce((s, x) => s + nights(x), 0), 'night')}${SEP}${ls.filter((x) => lockedHotel(x.id)).length} of ${ls.length} stays locked` });
      } else if (!key && current === null && !html) {
        html += '<div class="group-label" style="margin-top:28px">Setting off</div>';
      }
      const cc = dayCountry(d);
      const h = l && lockedHotel(l.id);
      const e = evList(d);
      const note = noteFor(d);
      html += `<div class="aday ${d === t ? 'is-today' : ''}" data-act="open-day" data-date="${d}" ${d === t ? 'id="agenda-today"' : ''} role="button" tabindex="0" style="--cc:${ccolor(cc) || 'var(--sand)'}">
        <div class="aday-date"><div class="w">${fmt(d, { weekday: 'short' })}</div><div class="d">${toDate(d).getUTCDate()}</div><div class="m">${fmt(d, { month: 'short' })}</div></div>
        <div>
          <div class="place"><span class="sw"></span>${esc(l ? l.place : (overnightFlight(d) ? 'In the air' : 'No stay planned'))}${d === t ? ' <span class="tag tag-todo">Today</span>' : ''}</div>
          ${l ? `<div class="hotel ${h ? '' : 'unset'}">${esc(h ? h.name : 'Hotel not chosen yet')}</div>` : ''}
          ${e.map((x) => `<div class="ev ${x.cls}">${x.icon}<span>${esc(x.txt)}</span></div>`).join('')}
          ${note && note.text ? `<div class="aday-note">${ICON.note}<span>${esc(note.text.slice(0, 110))}${note.text.length > 110 ? '…' : ''}</span></div>` : ''}
        </div>
      </div>`;
    });
    return `${head}<div class="wrap narrow">
      <p class="purpose">Every day of the trip: where you sleep, how you get there and what’s planned. Tap a day for the details and notes.</p>
      ${html}
    </div>`;
  }

  function calendarHTML(t) {
    const days = tripDays();
    const months = [];
    days.forEach((d) => { const k = d.slice(0, 7); if (!months.length || months[months.length - 1].k !== k) months.push({ k, days: [] }); months[months.length - 1].days.push(d); });
    const dow = (iso) => (toDate(iso).getUTCDay() + 6) % 7;
    const first = days[0], last = days[days.length - 1];
    const grids = months.map((m) => {
      const a = m.days[0], b = m.days[m.days.length - 1];
      const gs = addDays(a, -dow(a)), ge = addDays(b, 6 - dow(b));
      const cells = [];
      for (let d = gs; d <= ge; d = addDays(d, 1)) {
        const inTrip = d >= first && d <= last && d.slice(0, 7) === m.k;
        if (!inTrip) { cells.push(`<div class="cell out" aria-hidden="true"><div class="dn">${d.slice(0, 7) === m.k ? toDate(d).getUTCDate() : ''}</div></div>`); continue; }
        const cc = dayCountry(d);
        const l = legFor(d);
        const h = l && lockedHotel(l.id);
        const e = evList(d);
        const hasTr = transportOn(d).length, hasBk = activitiesOn(d).some(isBooked);
        const note = noteFor(d);
        cells.push(`<button class="cell ${d === t ? 'is-today' : ''}" data-act="open-day" data-date="${d}" style="--cc:${ccolor(cc) || 'transparent'}" aria-label="${esc(fLong(d))}${l ? `, ${esc(l.place)}` : ''}">
          <div class="dn"><span>${toDate(d).getUTCDate()}</span>${d === t ? '<small>Today</small>' : note && note.text ? '<span class="notedot" title="Has a note"></span>' : ''}</div>
          <div class="place">${esc(l ? l.place : (overnightFlight(d) ? 'In the air' : ''))}</div>
          ${h ? `<div class="hotel">${esc(h.name)}</div>` : ''}
          ${e.slice(0, 2).map((x) => `<div class="ev ${x.cls}">${x.icon}<span>${esc(x.txt)}</span></div>`).join('')}
          ${e.length > 2 ? `<div class="more">+${e.length - 2} more</div>` : ''}
          <span class="marks">${hasTr ? '<i></i>' : ''}${hasBk ? '<i class="o"></i>' : ''}</span>
        </button>`);
      }
      return `<div class="cal-month"><h3>${esc(fmt(a, { month: 'long', year: 'numeric' }))}</h3><div class="month-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => `<div class="dow">${x}</div>`).join('')}${cells.join('')}</div></div>`;
    }).join('');
    return `<div class="wrap">
      <p class="purpose">The whole trip at a glance, coloured by country. Tap any day to open it.</p>
      <div class="legend">${D.countries.map((c) => `<span><i style="background:${ccolor(c.id)}"></i>${esc(c.name)}</span>`).join('')}<span><i style="background:${AIR_COLOR}"></i>Overnight flight</span></div>
      ${grids}
    </div>`;
  }

  function journeysHTML() {
    const f = ui.sub.tFilter || 'all';
    let list = D.transport.slice().sort(byTime);
    if (f === 'to-book') list = list.filter((x) => x.status !== 'booked');
    if (f === 'booked') list = list.filter((x) => x.status === 'booked');
    if (f === 'flight') list = list.filter((x) => x.mode === 'flight');
    const groups = {};
    list.forEach((x) => { (groups[x.date] = groups[x.date] || []).push(x); });
    const total = D.transport.reduce((s, x) => s + num(x.price), 0);
    const paid = D.transport.reduce((s, x) => s + num(x.paid), 0);
    const chip = (v, l) => `<button class="chip ${f === v ? 'on' : ''}" aria-pressed="${f === v}" data-act="tfilter" data-v="${v}">${l}</button>`;
    return `<div class="wrap">
      <p class="purpose">Every flight, train and transfer. Add times, terminals and references as you book them; they show up on the day.</p>
      <p class="summary-line"><b>${D.transport.filter((x) => x.mode === 'flight').length}</b> flights${SEP}<b>${D.transport.filter((x) => x.status === 'booked').length}</b> of ${D.transport.length} booked${SEP}<b>${money(total)}</b> entered${SEP}<b>${money(paid)}</b> paid</p>
      <div class="sh sh-first"><div class="filters" style="margin:0">${chip('all', 'All')}${chip('to-book', 'To book')}${chip('booked', 'Booked')}${chip('flight', 'Flights')}</div>
        <div class="btn-row"><button class="btn btn-sm btn-orange" data-act="add" data-col="transport">${ICON.plus}Add travel</button></div></div>
      <div class="journeys">
        ${Object.keys(groups).map((d) => `
          <div class="jday">
            <div class="jday-date">${fShort(d)}<span>${fmt(d, { weekday: 'long' })}</span></div>
            <div class="tickets">${groups[d].map((x) => ticketHTML(x)).join('')}</div>
          </div>`).join('') || '<p class="empty">Nothing matches this filter.</p>'}
      </div>
    </div>`;
  }

  function viewStays() {
    const ls = legs();
    const sel = ui.sub.stays || 'all';
    const lockedTotal = D.hotels.filter((h) => h.locked).reduce((s, h) => s + hotelTotal(h), 0);
    const totalNights = ls.reduce((s, l) => s + nights(l), 0);
    const lockedN = ls.filter((l) => lockedHotel(l.id)).length;
    const tabs = [['all', 'All stops', `${lockedN}/${ls.length}`]].concat(D.countries.filter((c) => legsOf(c.id).length).map((c) => {
      const cl = legsOf(c.id); return [c.id, c.name, `${cl.filter((l) => lockedHotel(l.id)).length}/${cl.length}`];
    }));
    const selC = sel !== 'all' ? country(sel) : null;
    let html = `
      ${bandHTML({ title: selC ? `Stays · ${selC.name}` : 'Stays', ctry: selC || focusCountry(2), stops: selC ? legStops(selC.id) : countryStops(), strip: `<b>${lockedN} of ${ls.length}</b> stops locked in${SEP}${plural(totalNights, 'night')}${SEP}${money(lockedTotal)} locked` })}
      ${subtabsHTML(tabs, sel, 'stays', 'Stays by country')}
      <div class="wrap">
      <p class="purpose">Compare the options for each stop and lock one in. A locked stay becomes tonight’s hotel on those days, and its cost joins the budget. Prices are for the room, for two.</p>`;
    const countries = sel === 'all' ? D.countries : D.countries.filter((c) => c.id === sel);
    countries.forEach((c) => {
      const cl = legsOf(c.id);
      if (!cl.length) return;
      if (sel === 'all') {
        const span = countrySpan(c.id);
        html += `</div>${bandHTML({ title: c.name, ctry: c, stops: legStops(c.id), compact: true, level: 2, strip: `${span ? esc(fRange(span.start, span.end)) : ''}${SEP}${cl.filter((l) => lockedHotel(l.id)).length} of ${cl.length} locked` })}<div class="wrap">`;
      }
      cl.forEach((l) => { html += stopHTML(l); });
    });
    if (sel === 'all') {
      const orphan = ls.filter((l) => !D.countries.find((c) => c.id === l.country));
      orphan.forEach((l) => { html += stopHTML(l); });
    }
    html += `<div class="btn-row" style="margin-top:40px"><button class="btn btn-sm" data-act="add" data-col="legs">${ICON.plus}Add a stop</button></div></div>`;
    return html;
  }

  function stopHTML(l) {
    const opts = D.hotels.filter((h) => h.legId === l.id);
    const lk = opts.find((h) => h.locked);
    const exp = !lk || ui.expanded[l.id];
    const shown = opts.filter((h) => exp || h.locked).sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0));
    const n = nights(l);
    return `
      <section class="stop" id="leg-${l.id}">
        <div class="stop-head">
          <div>
            <h3 class="stop-title">${esc(l.place)}</h3>
            <div class="stop-when">${fRange(l.checkIn, l.checkOut)} · ${plural(n, 'night')}</div>
          </div>
          ${lk ? `<span class="tag tag-ok">${ICON.check}${esc(lk.name)}</span>` : l.priority ? '<span class="tag tag-warn">Choose first: other bookings depend on it</span>' : `<span class="tag tag-todo">${plural(opts.length, 'option')} to compare</span>`}
        </div>
        ${l.notes ? `<p class="stop-notes">${esc(l.notes)}</p>` : ''}
        <div class="opts">${shown.map((h) => optHTML(h, n)).join('') || '<p class="empty">No options yet. Add the first one.</p>'}</div>
        <div class="stop-foot">
          ${lk && opts.length > 1 ? `<button class="btn btn-sm btn-quiet" data-act="expand" data-leg="${l.id}">${exp ? 'Hide the alternatives' : `Show ${plural(opts.length - 1, 'alternative')}`}</button>` : ''}
          <button class="btn btn-sm btn-quiet" data-act="add" data-col="hotels" data-leg="${l.id}">${ICON.plus}Add an option</button>
          <button class="btn btn-sm btn-quiet" data-act="edit" data-col="legs" data-id="${l.id}">Edit stop</button>
        </div>
      </section>`;
  }

  function optHTML(h, n) {
    const u = safeUrl(h.url);
    const pros = lines(h.pros), cons = lines(h.cons);
    const total = hotelTotal(h);
    const meta = [h.suggested ? 'Pelorus suggested' : '', h.bookingRef ? `Ref <span class="ref">${esc(h.bookingRef)}</span>` : ''].filter(Boolean).join(' · ');
    const pc = (list, cls, title, icon) => (list.length
      ? `<div class="opt-pc ${cls}"><div class="pc-h">${icon}${title}</div><ul>${list.map((x) => `<li>${icon}<span>${esc(x)}</span></li>`).join('')}</ul></div>`
      : '<div class="opt-pc empty" aria-hidden="true"></div>');
    const notes = [h.notes ? esc(h.notes) : '', h.cancelBy ? `Free cancellation until ${fDay(h.cancelBy)}` : ''].filter(Boolean);
    return `<article class="opt ${h.locked ? 'is-locked' : ''}">
      <div class="opt-head">
        <div class="opt-name">${u ? `<a class="lnk lnk-ext" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(h.name)}</a>` : esc(h.name)}</div>
        ${h.category ? `<div class="opt-cat">${esc(h.category)}</div>` : ''}
        ${meta ? `<div class="opt-meta">${meta}</div>` : ''}
      </div>
      <div class="opt-price">
        <div><div class="k">Per night</div><div class="p">${num(h.pricePerNight) ? money(num(h.pricePerNight)) : '—'}</div><div class="r">${h.range ? esc(h.range) : '&nbsp;'}</div></div>
        <div class="tot"><div class="k">${num(h.totalPrice) ? 'Quoted total' : `${plural(n, 'night')}`}</div><div class="p">${total ? money(total) : '—'}</div><div class="r">${num(h.paid) ? `Paid ${money(num(h.paid))}` : '&nbsp;'}</div></div>
      </div>
      ${pc(pros, 'pro', 'Pros', ICON.check)}
      ${pc(cons, 'con', 'Cons', ICON.minus)}
      <div class="opt-notes">${notes.map((x) => `<p>${x}</p>`).join('')}</div>
      <div class="opt-foot">
        ${h.locked
          ? `<span class="locked-mark">${ICON.check}Locked in</span><span class="spacer"></span><button class="btn btn-sm btn-quiet" data-act="book" data-col="hotels" data-id="${h.id}">${h.bookingRef ? 'Details' : 'Add booking'}</button><button class="btn btn-sm btn-quiet" data-act="unlock" data-id="${h.id}">Unlock</button>`
          : `<button class="btn btn-sm btn-orange" data-act="lock" data-id="${h.id}">Lock in</button><span class="spacer"></span><button class="btn btn-sm btn-quiet" data-act="edit" data-col="hotels" data-id="${h.id}">Edit</button>`}
      </div>
    </article>`;
  }

  function viewActivities() {
    const f = ui.sub.activities || 'all';
    const filt = (a) => f === 'all' || (f === 'need' && a.needsBookingAhead && !isBooked(a)) || (f === 'booked' && isBooked(a)) || (f === 'short' && (a.status === 'shortlist' || isBooked(a)));
    const n = {
      all: D.activities.length,
      need: D.activities.filter((a) => a.needsBookingAhead && !isBooked(a)).length,
      short: D.activities.filter((a) => a.status === 'shortlist' || isBooked(a)).length,
      booked: D.activities.filter(isBooked).length,
    };
    const ls = legs();
    let body = '';
    D.countries.forEach((c) => {
      const cl = ls.filter((l) => l.country === c.id);
      const any = cl.some((l) => D.activities.some((a) => a.legId === l.id && filt(a)));
      if (!cl.length || (!any && f !== 'all')) return;
      const span = countrySpan(c.id);
      body += `</div>${bandHTML({ title: c.name, ctry: c, stops: legStops(c.id), compact: true, level: 2, strip: `${span ? esc(fRange(span.start, span.end)) : ''}${SEP}${plural(D.activities.filter((a) => cl.some((l) => l.id === a.legId)).length, 'idea')}` })}<div class="wrap">`;
      cl.forEach((l) => {
        const acts = D.activities.filter((a) => a.legId === l.id && filt(a)).sort(byTime);
        if (!acts.length && f !== 'all') return;
        body += `<div class="stop-mini"><div><h3>${esc(l.place)}</h3><div class="stop-when">${fRange(l.checkIn, l.checkOut)}</div></div>
          <button class="btn btn-sm btn-quiet" data-act="add" data-col="activities" data-leg="${l.id}">${ICON.plus}Add idea</button></div>
          <div class="acts">${acts.map(actHTML).join('') || '<p class="empty">No ideas yet.</p>'}</div>`;
      });
    });
    const loose = D.activities.filter((a) => !legById(a.legId) && filt(a));
    if (loose.length) body += `<div class="stop-mini"><h3>Not tied to a stop</h3></div><div class="acts">${loose.map(actHTML).join('')}</div>`;
    if (!body) body = '<p class="empty" style="text-align:center;margin-top:30px">Nothing here yet.</p>';
    return `
      ${bandHTML({ title: 'Activities', ctry: focusCountry(3), stops: countryStops(), strip: `${plural(n.all, 'idea')}${SEP}${n.short} shortlisted${SEP}<b>${n.need}</b> to book ahead${SEP}${n.booked} booked` })}
      ${subtabsHTML([['all', 'All', n.all], ['need', 'To book ahead', n.need], ['short', 'Shortlist', n.short], ['booked', 'Booked', n.booked]], f, 'activities', 'Filter activities')}
      <div class="wrap">
        <p class="purpose">Ideas for each stop. Star the ones you want, flag the ones that need booking ahead, and mark them booked with a reference once they’re confirmed.</p>
        ${body}
      </div>`;
  }

  function actHTML(a) {
    const u = safeUrl(a.url);
    const b = isBooked(a);
    const short = a.status === 'shortlist' || b;
    const meta = [a.date ? fDay(a.date) : 'Any day', a.time, num(a.cost) ? `About ${money(num(a.cost))} for two` : ''].filter(Boolean).map(esc).join(' · ');
    return `<article class="act">
      <div class="act-title">${u ? `<a class="lnk lnk-ext" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>` : esc(a.title)}</div>
      <div class="act-meta">${meta}</div>
      ${(a.priority && !b) || (a.bookBy && !b) || b ? `<div class="tags">
        ${a.priority && !b ? '<span class="tag tag-warn">Key booking</span>' : ''}
        ${a.bookBy && !b ? `<span class="tag tag-warn">Book by ${fShort(a.bookBy)}</span>` : ''}
        ${b ? `<span class="tag tag-ok">${ICON.check}Booked${a.bookingRef ? ` · ${esc(a.bookingRef)}` : ''}</span>` : ''}
      </div>` : ''}
      ${a.notes ? `<div class="act-notes">${esc(a.notes)}</div>` : ''}
      <div class="act-actions">
        <button class="chip ${short ? 'on' : ''}" aria-pressed="${short}" data-act="act-short" data-id="${a.id}" ${b ? 'disabled' : ''}>${ICON.star}${short ? 'Shortlisted' : 'Shortlist'}</button>
        <button class="chip ${a.needsBookingAhead ? 'on-orange' : ''}" aria-pressed="${!!a.needsBookingAhead}" data-act="act-ahead" data-id="${a.id}">${ICON.flag}Book ahead</button>
        ${b ? `<button class="chip on-ok" aria-pressed="true" data-act="act-booked" data-id="${a.id}" title="Mark as not booked">${ICON.check}Booked</button>`
          : `<button class="btn btn-sm btn-orange" data-act="book" data-col="activities" data-id="${a.id}">Mark booked</button>`}
        <button class="btn btn-sm btn-quiet" data-act="edit" data-col="activities" data-id="${a.id}">Edit</button>
      </div>
    </article>`;
  }

  function currencies() { return ['GBP'].concat(Object.keys(D.meta.fx || {})); }
  function toGBP(amt, cur) { if (cur === 'GBP') return amt; const r = num(D.meta.fx[cur]); return r ? amt / r : amt; }
  function defaultCurrency(date) { const c = country(dayCountry(date || todayISO())); return c && c.currency && D.meta.fx[c.currency] ? c.currency : 'GBP'; }
  const catOpts = () => D.allocations.map((a) => [a.id, a.label]).concat([['OTHER', 'Other']]);

  function spendFormHTML(id, { date, cat } = {}) {
    const { inTrip } = tripState();
    const d = date || todayISO();
    const cur = defaultCurrency(inTrip || date ? d : null);
    const c = cat || (legFor(d) || {}).country || 'OTHER';
    return `<form class="spend-form" id="${id}" data-spend="1">
      <div class="field f-amt"><label for="${id}-amt">Amount</label><input id="${id}-amt" name="amount" inputmode="decimal" autocomplete="off" required></div>
      <div class="field f-cur"><label for="${id}-cur">Currency</label><select id="${id}-cur" name="cur">${currencies().map((k) => `<option ${k === cur ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="field f-what"><label for="${id}-what">What for</label><input id="${id}-what" name="label" placeholder="Dinner, taxi, tickets…" required></div>
      <div class="field f-cat"><label for="${id}-cat">Budget line</label><select id="${id}-cat" name="category">${catOpts().map(([k, l]) => `<option value="${esc(k)}" ${k === c ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="f-go"><input type="hidden" name="date" value="${esc(d)}"><button class="btn btn-fill btn-block" type="submit">Log it</button></div>
      <div class="conv" data-conv>Logged as paid, in pounds at your planning rates.</div>
    </form>`;
  }

  function viewBudget() {
    const sub = ui.sub.budget || 'overview';
    const items = budgetItems();
    const ceil = num(D.meta.budgetCeiling), pref = num(D.meta.budgetPreferred);
    const committed = items.reduce((s, i) => s + i.amount, 0);
    const paid = items.reduce((s, i) => s + i.paid, 0);
    const planned = D.allocations.reduce((s, a) => s + num(a.planned), 0);
    const head = `
      ${bandHTML({ title: 'Budget', ctry: focusCountry(), stops: countryStops(), strip: `<b>${money(paid)}</b> spent${SEP}<b>${money(committed)}</b> committed${SEP}${money(ceil)} ceiling` })}
      ${subtabsHTML([['overview', 'Overview'], ['spending', 'Spending'], ['currency', 'Currency']], sub, 'budget', 'Budget view')}`;

    if (sub === 'spending') {
      return `${head}<div class="wrap">
        <p class="purpose">Log what you spend as you go, in any currency. It converts to pounds at your planning rates and counts towards the budget straight away.</p>
        <div class="sh"><h2>Log spending</h2></div>
        ${spendFormHTML('spendInline')}
        <div class="sh"><h2>Spending log</h2><span class="sh-meta">${money(D.expenses.reduce((s, e) => s + num(e.amount), 0))} in total</span></div>
        <table class="table rt">
          <thead><tr><th>Item</th><th>Budget line</th><th class="r">Amount</th><th class="r">Paid</th><th></th></tr></thead>
          <tbody>${D.expenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e) => `<tr>
            <td data-label="">${esc(e.label)}${e.date || e.notes ? `<span class="sub">${e.date ? fDay(e.date) : ''}${e.date && e.notes ? ' · ' : ''}${esc(e.notes || '')}</span>` : ''}</td>
            <td data-label="Budget line" class="inline-m">${esc(catLabel(e.category))}</td>
            <td class="r inline-m price" data-label="Amount">${money(num(e.amount))}</td>
            <td class="r inline-m price" data-label="Paid">${money(num(e.paid))}</td>
            <td data-label=""><button class="btn btn-sm btn-quiet" data-act="edit" data-col="expenses" data-id="${e.id}">Edit</button></td>
          </tr>`).join('') || '<tr><td colspan="5" class="empty">Nothing logged yet. The form above is the quickest way.</td></tr>'}</tbody>
        </table>
      </div>`;
    }

    if (sub === 'currency') {
      const fx = D.meta.fx || {};
      const keys = Object.keys(fx);
      return `${head}<div class="wrap narrow">
        <p class="purpose">A quick converter for prices you see while away, using your planning rates. These are not live payment rates.</p>
        <div class="sh"><h2>Convert to pounds</h2></div>
        <div class="fx">
          <div class="field"><label for="fxAmt">Amount</label><input id="fxAmt" inputmode="decimal" autocomplete="off"></div>
          <div class="field"><label for="fxCur">Currency</label><select id="fxCur">${keys.map((k) => `<option ${k === defaultCurrency() ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          <output id="fxOut" aria-live="polite">£0</output>
        </div>
        <div class="sh"><h2>Planning rates</h2><div class="btn-row"><button class="btn btn-sm" data-act="edit-fx">Edit rates</button></div></div>
        <table class="table rates"><thead><tr><th>Currency</th><th class="r">£1 buys</th><th class="r">1,000 is about</th></tr></thead>
          <tbody>${keys.map((k) => `<tr><td>${esc(k)}</td><td class="r price">${esc(fx[k])} ${esc(k)}</td><td class="r price">£${(1000 / (num(fx[k]) || 1)).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</td></tr>`).join('')}</tbody></table>
      </div>`;
    }

    const pct = (v) => `${Math.max(0, Math.min(100, (v / ceil) * 100))}%`;
    const edge = (v) => (v / ceil > 0.8 ? 'edge-r' : v / ceil < 0.2 ? 'edge-l' : '');
    const cats = D.allocations.map((a) => a.id);
    items.forEach((i) => { if (!cats.includes(i.cat)) cats.push(i.cat); });
    const rows = cats.map((id) => {
      const a = D.allocations.find((x) => x.id === id);
      const its = items.filter((i) => i.cat === id);
      const c = its.reduce((s, i) => s + i.amount, 0), p = its.reduce((s, i) => s + i.paid, 0);
      const pl = a ? num(a.planned) : 0;
      const ratio = pl ? c / pl : (c ? 1.01 : 0);
      return `<tr>
        <td data-label="">${esc(a ? a.label : catLabel(id))}${a && a.notes ? `<span class="sub">${esc(a.notes)}</span>` : ''}
          ${its.length ? `<details class="items"><summary>${plural(its.length, 'item')}</summary><ul>${its.map((i) => `<li><span>${esc(i.label)}</span><span class="num">${money(i.amount)}${i.paid ? ` · paid ${money(i.paid)}` : ''}</span></li>`).join('')}</ul></details>` : ''}
        </td>
        <td class="r inline-m price" data-label="Planned">${money(pl)}</td>
        <td class="r inline-m price" data-label="Committed">${money(c)}<div class="mini-bar"><span class="${ratio > 1 ? 'over' : ''}" style="width:${Math.min(100, ratio * 100)}%"></span></div></td>
        <td class="r inline-m price" data-label="Paid">${money(p)}</td>
        <td class="r inline-m price ${pl - c < 0 ? 'bad' : ''}" data-label="Plan left">${money(pl - c)}</td>
        <td data-label="">${a ? `<button class="btn btn-sm btn-quiet" data-act="edit" data-col="allocations" data-id="${a.id}">Edit</button>` : ''}</td>
      </tr>`;
    }).join('');

    return `${head}<div class="wrap">
      <p class="purpose">${money(pref)} preferred, ${money(ceil)} ceiling. <b>Committed</b> counts locked stays, travel prices, booked activities and logged spending. <b>Spent</b> is what’s marked as paid.</p>
      <div class="money-head">
        <div><div class="k">Left to spend</div><div class="v ${ceil - paid < 0 ? 'bad' : ''}">${money(ceil - paid)}</div><div class="s">${money(paid)} spent of the ${money(ceil)} ceiling</div></div>
        <div class="${ceil - committed < 0 ? 'bad' : ''}"><div class="k">Committed</div><div class="v">${money(committed)}</div><div class="s">${ceil - committed < 0 ? `${money(committed - ceil)} over the ceiling` : `${money(ceil - committed)} not yet committed`}</div></div>
        <div><div class="k">Planned</div><div class="v">${money(planned)}</div><div class="s">${money(ceil - planned)} below the ceiling</div></div>
      </div>
      <div class="bar" role="img" aria-label="Spent ${money(paid)}, committed ${money(committed)} of ${money(ceil)}">
        <div class="seg committed" style="width:${pct(committed)}"></div>
        <div class="seg paid" style="width:${pct(paid)}"></div>
        <div class="mark ${edge(pref)}" style="left:${pct(pref)}"><span>Preferred ${money(pref)}</span></div>
        <div class="mark top ${edge(planned)}" style="left:${pct(planned)}"><span>Plan ${money(planned)}</span></div>
      </div>
      <div class="bar-legend"><span><i style="background:var(--ink)"></i>Paid</span><span><i style="background:var(--orange);opacity:.45"></i>Committed</span><span><i style="background:var(--stone)"></i>Still free</span></div>

      <div class="sh"><h2>By budget line</h2><div class="btn-row"><button class="btn btn-sm btn-orange" data-act="sub" data-tab="budget" data-v="spending">${ICON.pound}Log spending</button></div></div>
      <table class="table rt">
        <thead><tr><th>Budget line</th><th class="r">Planned</th><th class="r">Committed</th><th class="r">Paid</th><th class="r">Plan left</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td data-label="">Total</td><td class="r inline-m price" data-label="Planned">${money(planned)}</td><td class="r inline-m price" data-label="Committed">${money(committed)}</td><td class="r inline-m price" data-label="Paid">${money(paid)}</td><td class="r inline-m price" data-label="Plan left">${money(planned - committed)}</td><td></td></tr></tfoot>
      </table>
      ${D.meta.budgetNote ? `<p class="small muted" style="margin-top:14px">${esc(D.meta.budgetNote)}</p>` : ''}
    </div>`;
  }

  /* ---------------- Render ---------------- */
  const VIEWS = { today: viewToday, itinerary: viewItinerary, stays: viewStays, activities: viewActivities, budget: viewBudget };
  const ALIASES = { travel: ['itinerary', 'journeys'], calendar: ['itinerary', 'calendar'], ideas: ['activities', null] };

  let renderPending = false;
  function render() {
    if (!D) return;
    renderPending = false;
    const v = $('#view');
    v.innerHTML = (VIEWS[ui.tab] || viewToday)();
    $$('[data-tab]').forEach((a) => { if (a.tagName === 'A') { a.classList.toggle('active', a.dataset.tab === ui.tab); if (a.dataset.tab === ui.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
    const on = $('.subtabs .on');
    if (on && on.parentElement.scrollWidth > on.parentElement.clientWidth) on.parentElement.scrollLeft = on.offsetLeft - 16;
    if (ui.tab === 'itinerary' && (ui.sub.itinerary || 'days') === 'days' && !ui.scrolledToday) {
      requestAnimationFrame(() => {
        const el = $('#agenda-today');
        if (el && el.offsetParent) { el.scrollIntoView({ block: 'center' }); ui.scrolledToday = true; }
      });
    }
    setSync();
  }
  function safeRender() {
    if ($('#sheet').open) { safeRender.pending = true; return; }
    const a = document.activeElement;
    if (a && a.closest('#view') && a.matches('input, textarea, select')) { renderPending = true; return; }
    render();
  }

  function route() {
    const raw = location.hash.replace('#', '') || 'today';
    let [tab, sub] = raw.split('/');
    if (ALIASES[tab]) { [tab, sub] = [ALIASES[tab][0], sub || ALIASES[tab][1]]; }
    if (!VIEWS[tab]) tab = 'today';
    const changed = tab !== ui.tab;
    ui.tab = tab;
    if (sub) { if (tab === 'today') ui.homeMode = sub; else ui.sub[tab] = sub; }
    render();
    if (changed) window.scrollTo(0, 0);
  }

  function setSub(tab, v) {
    if (tab === 'today') ui.homeMode = v; else ui.sub[tab] = v;
    if (tab === 'itinerary') ui.scrolledToday = false;
    history.replaceState(null, '', `#${tab}/${v}`);
    const st = $('.subtabs');
    const keep = st ? st.getBoundingClientRect().top < 0 : false;
    render();
    if (keep) { const s = $('.subtabs'); if (s) window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - $('.topbar').offsetHeight); }
  }

  /* ---------------- Editor ---------------- */
  const STATUS_OPTS = [['to-book', 'To book'], ['booked', 'Booked'], ['idea', 'Idea']];
  const legOpts = () => legs().map((l) => [l.id, `${l.place} (${fRange(l.checkIn, l.checkOut)})`]);
  const countryOpts = () => D.countries.map((c) => [c.id, c.name]);

  const SCHEMA = {
    transport: { title: 'Travel', prefix: 'T', fields: () => [
      ['date', 'Date', 'date'], ['mode', 'Type', 'select', [['flight', 'Flight'], ['rail', 'Train'], ['road', 'Car / driver'], ['transfer', 'Transfer'], ['ferry', 'Ferry'], ['other', 'Other']]],
      ['from', 'From'], ['to', 'To'],
      ['carrier', 'Airline / operator'], ['number', 'Flight / train number'],
      ['depTime', 'Departs (local time)', 'time'], ['arrTime', 'Arrives (local time)', 'time'],
      ['depTerminal', 'Departure terminal / station'], ['arrTerminal', 'Arrival terminal / station'],
      ['arrDate', 'Arrival date if next day', 'date'], ['bookingRef', 'Booking reference'],
      ['seats', 'Seats'], ['bags', 'Baggage allowance'],
      ['price', 'Price for both (£)', 'number'], ['paid', 'Paid so far (£)', 'number'],
      ['status', 'Status', 'select', STATUS_OPTS], ['bookBy', 'Book by', 'date'],
      ['budgetCat', 'Budget line', 'select', catOpts()], ['link', 'Booking link', 'url'],
      ['link2', 'Second link', 'url', null, true], ['notes', 'Notes', 'textarea'],
    ] },
    hotels: { title: 'Hotel option', prefix: 'H', fields: () => [
      ['name', 'Hotel name', 'text', null, true], ['url', 'Website', 'url', null, true],
      ['category', 'Category / room'], ['range', 'Price range note'],
      ['pricePerNight', 'Price per night for two (£)', 'number'], ['totalPrice', 'Quoted total for the stay (£)', 'number'],
      ['pros', 'Pros (one per line)', 'textarea'], ['cons', 'Cons (one per line)', 'textarea'],
      ['address', 'Address', 'text', null, true], ['phone', 'Phone'], ['bookingRef', 'Booking reference'],
      ['checkInTime', 'Check-in time'], ['cancelBy', 'Free cancellation until', 'date'],
      ['paid', 'Paid so far (£)', 'number'], ['suggested', 'Pelorus suggested', 'checkbox'],
      ['notes', 'Notes', 'textarea'],
    ] },
    activities: { title: 'Activity', prefix: 'A', fields: () => [
      ['title', 'Activity', 'text', null, true], ['url', 'Link', 'url', null, true],
      ['legId', 'Where', 'select', legOpts()], ['date', 'Date', 'date'],
      ['time', 'Time', 'time'], ['cost', 'Cost for two (£)', 'number'],
      ['status', 'Status', 'select', [['idea', 'Idea'], ['shortlist', 'Shortlist'], ['booked', 'Booked']]], ['paid', 'Paid so far (£)', 'number'],
      ['needsBookingAhead', 'Needs booking ahead', 'checkbox'], ['bookBy', 'Book by', 'date'],
      ['bookingRef', 'Booking reference'], ['priority', 'Key booking (others depend on it)', 'checkbox'],
      ['notes', 'Notes', 'textarea'],
    ] },
    expenses: { title: 'Spending', prefix: 'E', fields: () => [
      ['label', 'What', 'text', null, true], ['category', 'Budget line', 'select', catOpts()], ['date', 'Date', 'date'],
      ['amount', 'Amount (£)', 'number'], ['paid', 'Paid (£)', 'number'], ['notes', 'Notes', 'textarea'],
    ] },
    allocations: { title: 'Budget line', prefix: 'B', fields: () => [
      ['label', 'Budget line', 'text', null, true], ['planned', 'Planned (£)', 'number'], ['notes', 'What it covers', 'textarea'],
    ] },
    tasks: { title: 'Task', prefix: 'K', fields: () => [
      ['title', 'Task', 'textarea'], ['url', 'Link', 'url', null, true], ['done', 'Done', 'checkbox'],
    ] },
    legs: { title: 'Stop', prefix: 'L', fields: () => [
      ['place', 'Place', 'text', null, true], ['country', 'Country', 'select', countryOpts()],
      ['checkIn', 'Check-in', 'date'], ['checkOut', 'Check-out', 'date'],
      ['priority', 'Choose this stay first (other bookings depend on it)', 'checkbox'], ['notes', 'Notes', 'textarea'],
    ] },
    countries: { title: 'Country', prefix: 'C', fields: () => [
      ['name', 'Name', 'text', null, true], ['sub', 'Places, in a line'], ['dates', 'Dates label'],
      ['image', 'Photo link (https://…)', 'url', null, true, 'A landscape photo for this country’s header. Paste a direct image link; it is stored encrypted with the plan.'],
      ['imageCredit', 'Photo credit', 'text', null, true, 'Shown small on the photo. Needed for Creative Commons photos, e.g. “Photo: Name / Wikimedia Commons, CC BY-SA 4.0”.'],
      ['currency', 'Local currency', 'select', [['', 'Pounds (GBP)']].concat(Object.keys(D.meta.fx || {}).map((k) => [k, k]))],
      ['color', 'Colour on the calendar', 'color'],
    ] },
  };

  function fieldHTML([f, label, type = 'text', opts, full, hint], rec, extraCls = '') {
    const v = rec[f];
    const id = `f-${f}`;
    const isFull = full || type === 'textarea';
    if (type === 'checkbox') return `<div class="field check-field full"><input type="checkbox" class="check" id="${id}" name="${f}" ${v ? 'checked' : ''}><label for="${id}">${esc(label)}</label></div>`;
    let input;
    if (type === 'select') input = `<select id="${id}" name="${f}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(v || '') === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    else if (type === 'textarea') input = `<textarea id="${id}" name="${f}" rows="3">${esc(v)}</textarea>`;
    else if (type === 'number') input = `<input id="${id}" name="${f}" type="text" inputmode="decimal" autocomplete="off" value="${v === 0 || v == null || v === '' ? '' : esc(v)}">`;
    else if (type === 'color') input = `<input id="${id}" name="${f}" type="color" value="${esc(v || PALETTE[0])}" style="padding:4px;height:44px">`;
    else input = `<input id="${id}" name="${f}" type="${type}" value="${esc(v)}" ${type === 'url' ? 'placeholder="https://…" autocapitalize="off" spellcheck="false"' : ''}>`;
    return `<div class="field ${isFull ? 'full' : 'half'} ${extraCls}"><label for="${id}">${esc(label)}</label>${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
  }

  function openSheet(title, html) {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = html;
    const s = $('#sheet');
    s.classList.remove('sheet-wide');
    ui.sheetDay = null;
    if (!s.open) s.showModal();
    $('#sheetTitle').focus({ preventScroll: true });
    $('#sheetBody').scrollTop = 0;
  }
  function closeSheet() {
    const s = $('#sheet');
    if (s.open) s.close();
  }

  function openEditor(col, id, defaults = {}) {
    const sc = SCHEMA[col];
    const existing = id && D[col].find((r) => r.id === id);
    const rec = existing ? { ...existing } : { ...defaults };
    if (col === 'countries' && existing && !rec.color) rec.color = ccolor(existing.id);
    const fields = sc.fields();
    openSheet(`${existing ? 'Edit' : 'Add'} ${sc.title.toLowerCase()}`, `
      <form class="form" id="editForm" data-col="${col}" data-id="${existing ? id : ''}">
        ${fields.map((f) => fieldHTML(f, rec)).join('')}
        <div class="form-actions">
          <button type="submit" class="btn btn-fill">Save</button>
          <button type="button" class="btn btn-quiet" data-close>Cancel</button>
          <span class="spacer"></span>
          ${existing && col !== 'countries' ? '<button type="button" class="btn btn-sm btn-danger" data-act="delete">Delete</button>' : ''}
        </div>
      </form>`);
    const form = $('#editForm');
    form._defaults = defaults;
    form._fields = fields;
  }

  /* The short "Mark booked" sheet: only what you have to hand when a booking confirms. */
  const BOOK_FIELDS = {
    transport: [['bookingRef', 'Booking reference'], ['number', 'Flight / train number'], ['depTime', 'Departs (local time)', 'time'], ['arrTime', 'Arrives (local time)', 'time'], ['depTerminal', 'Departure terminal'], ['arrTerminal', 'Arrival terminal'], ['price', 'Price for both (£)', 'number'], ['paid', 'Paid so far (£)', 'number'], ['seats', 'Seats', 'text', null, true]],
    activities: [['bookingRef', 'Booking reference', 'text', null, true], ['date', 'Date', 'date'], ['time', 'Time', 'time'], ['cost', 'Cost for two (£)', 'number'], ['paid', 'Paid so far (£)', 'number']],
    hotels: [['bookingRef', 'Booking reference'], ['checkInTime', 'Check-in time'], ['totalPrice', 'Quoted total for the stay (£)', 'number'], ['paid', 'Paid so far (£)', 'number'], ['cancelBy', 'Free cancellation until', 'date', null, true], ['address', 'Address', 'text', null, true], ['phone', 'Phone']],
  };
  function openBooking(col, id) {
    const rec = D[col].find((r) => r.id === id);
    if (!rec) return;
    let title = 'Mark booked', lede = '';
    if (col === 'transport') lede = `${esc(rec.from)} → ${esc(rec.to)} · ${fDay(rec.date)}${rec.carrier ? ` · ${esc(rec.carrier)}` : ''}`;
    if (col === 'activities') { const l = legById(rec.legId); lede = `${esc(rec.title)}${l ? ` · ${esc(l.place)}` : ''}`; }
    if (col === 'hotels') {
      const l = legById(rec.legId);
      title = rec.locked ? 'Booking details' : 'Lock in and book';
      lede = `${esc(rec.name)}${l ? ` · ${esc(l.place)}, ${fRange(l.checkIn, l.checkOut)}` : ''}`;
    }
    const done = col === 'hotels' ? 'Save booking' : (rec.status === 'booked' ? 'Save' : 'Save as booked');
    openSheet(title, `
      <p class="sheet-lede">${lede}. Fill in what you have now; everything is optional and you can add the rest later.</p>
      <form class="form" id="bookForm" data-col="${col}" data-id="${id}">
        ${BOOK_FIELDS[col].map((f) => fieldHTML(f, rec)).join('')}
        <div class="form-actions">
          <button type="submit" class="btn btn-fill">${ICON.check}${done}</button>
          <button type="button" class="btn btn-quiet" data-act="edit" data-col="${col}" data-id="${id}">All details</button>
        </div>
      </form>`);
    setTimeout(() => { const f = $('#bookForm input'); if (f && window.matchMedia('(pointer:fine)').matches) f.focus(); }, 60);
  }

  function submitBooking(form) {
    const col = form.dataset.col, id = form.dataset.id;
    const rec = D[col].find((r) => r.id === id);
    if (!rec) return;
    BOOK_FIELDS[col].forEach(([f, , type]) => {
      const el = form.elements[f]; if (!el) return;
      rec[f] = type === 'number' ? (el.value.trim() === '' ? 0 : num(el.value)) : el.value.trim();
    });
    if (col === 'hotels') {
      if (!rec.locked) { D.hotels.filter((x) => x.legId === rec.legId && x.locked).forEach((x) => { x.locked = false; touch(x); }); rec.locked = true; }
    } else rec.status = 'booked';
    touch(rec); commit(); closeSheet(); render();
    toast(col === 'hotels' ? `Saved: ${rec.name}` : 'Booked. It’s on the day in the itinerary.');
  }

  function submitEditor(form) {
    const col = form.dataset.col;
    const id = form.dataset.id;
    let rec = id ? D[col].find((r) => r.id === id) : null;
    if (!rec) { rec = { id: uid(SCHEMA[col].prefix), ...form._defaults }; D[col].push(rec); }
    form._fields.forEach(([f, , type]) => {
      const el = form.elements[f];
      if (!el) return;
      if (type === 'checkbox') rec[f] = el.checked;
      else if (type === 'number') rec[f] = el.value.trim() === '' ? 0 : num(el.value);
      else rec[f] = el.value.trim();
    });
    if (col === 'legs' && rec.checkOut < rec.checkIn) { const t = rec.checkIn; rec.checkIn = rec.checkOut; rec.checkOut = t; }
    touch(rec);
    commit();
    closeSheet();
    render();
  }

  function submitSpend(form) {
    const amt = num(form.elements.amount.value);
    if (!amt) { toast('Enter an amount'); form.elements.amount.focus(); return; }
    const cur = form.elements.cur.value;
    const gbp = Math.round(toGBP(amt, cur) * 100) / 100;
    const rec = touch({
      id: uid('E'), label: form.elements.label.value.trim() || 'Spending', category: form.elements.category.value,
      date: form.elements.date.value, amount: gbp, paid: gbp,
      notes: cur === 'GBP' ? '' : `${amt.toLocaleString('en-GB')} ${cur} at ${D.meta.fx[cur]} to £1`,
    });
    D.expenses.push(rec);
    commit();
    if ($('#sheet').open) closeSheet();
    render();
    toast(`Logged ${money(gbp)}${cur === 'GBP' ? '' : ` (${amt.toLocaleString('en-GB')} ${cur})`}`);
  }

  function removeRec(col, id) {
    D[col] = D[col].filter((x) => x.id !== id);
    D.deleted[id] = Date.now();
    if (col === 'legs') {
      D.hotels.filter((h) => h.legId === id).forEach((h) => { D.deleted[h.id] = Date.now(); });
      D.hotels = D.hotels.filter((h) => h.legId !== id);
    }
    commit();
  }

  function openDay(date) {
    openSheet(fLong(date), `${dayBody(date, true)}
      <div class="form-actions" style="margin-top:22px"><button class="btn btn-sm" data-act="goto-day" data-date="${date}">Open on the Home screen</button></div>`);
    $('#sheet').classList.add('sheet-wide'); // the day view has two columns; give them room on desktop
    ui.sheetDay = date;
  }

  /* ---------------- Settings ---------------- */
  function idleMinutes() { try { const v = localStorage.getItem('hm.idle'); return v == null ? 60 : Number(v); } catch (e) { return 60; } }

  function openSettings() {
    const r = Store.repo || { owner: '', name: '', branch: 'main' };
    const idle = idleMinutes();
    const s = syncState();
    openSheet('Settings', `
      <div class="settings-section">
        <h3>Saving and sync</h3>
        <p>${Store.localMode ? 'Local test mode. Changes are saved in this browser only.' : Store.token ? `Saving to <b>${esc(r.owner)}/${esc(r.name)}</b> on GitHub. Everything is encrypted on this device before it’s sent.` : 'This device can read the plan but not change it. Add a GitHub token below to make changes.'}</p>
        <p>Status: <b>${esc(s.txt)}</b>. ${esc(s.tip)}</p>
        <div class="btn-row"><button class="btn btn-sm" data-act="sync-now" ${Store.token ? '' : 'disabled'}>Check for changes now</button></div>
      </div>
      <div class="settings-section">
        <h3>Country photos and colours</h3>
        <p>Each country can have a header photo and a calendar colour.</p>
        <div class="btn-row">${D.countries.map((c) => `<button class="btn btn-sm" data-act="edit" data-col="countries" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>
      </div>
      <div class="settings-section">
        <h3>GitHub</h3>
        <form class="form" id="repoForm">
          <div class="field half"><label for="rOwner">Owner</label><input id="rOwner" value="${esc(r.owner)}" autocapitalize="off" spellcheck="false"></div>
          <div class="field half"><label for="rName">Repository</label><input id="rName" value="${esc(r.name)}" autocapitalize="off" spellcheck="false"></div>
          <div class="field half"><label for="rBranch">Branch</label><input id="rBranch" value="${esc(r.branch || 'main')}" autocapitalize="off" spellcheck="false"></div>
          <div class="field full"><label for="rToken">${Store.token ? 'Replace token' : 'Fine-grained token (Contents: read and write, this repo only)'}</label><input id="rToken" type="password" autocomplete="off" spellcheck="false" placeholder="${Store.token ? '•••••••• saved (encrypted)' : 'github_pat_…'}"></div>
          <div class="form-actions"><button class="btn btn-sm btn-fill" type="submit">Save</button>${Store.token ? '<button class="btn btn-sm btn-danger" type="button" data-act="clear-token">Remove token from this device</button>' : ''}</div>
        </form>
      </div>
      <div class="settings-section">
        <h3>Auto-lock</h3>
        <div class="field"><select id="idleSel" aria-label="Lock automatically after">
          ${[[15, 'After 15 minutes'], [60, 'After 1 hour'], [240, 'After 4 hours'], [720, 'After 12 hours'], [0, 'Never (not recommended)']].map(([v, l]) => `<option value="${v}" ${idle === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      </div>
      <div class="settings-section">
        <h3>Change passphrase</h3>
        <p>Re-encrypts the plan. The other device will need the new passphrase next time.</p>
        <form class="form" id="passForm">
          <div class="field half"><label for="np1">New passphrase</label><input id="np1" type="password" autocomplete="new-password"></div>
          <div class="field half"><label for="np2">Repeat</label><input id="np2" type="password" autocomplete="new-password"></div>
          <div class="form-actions"><button class="btn btn-sm btn-fill" type="submit" ${Store.canWrite ? '' : 'disabled'}>Change passphrase</button></div>
        </form>
      </div>
      <div class="settings-section">
        <h3>Backup</h3>
        <p>The JSON export is <b>not encrypted</b>. Keep it somewhere private.</p>
        <div class="btn-row">
          <button class="btn btn-sm" data-act="export">Export JSON</button>
          <label class="btn btn-sm" for="importFile">Import JSON</label><input id="importFile" type="file" accept=".json,application/json" hidden>
          <button class="btn btn-sm" data-act="download-enc">Download encrypted file</button>
        </div>
      </div>
      <div class="settings-section" style="border:0">
        <div class="btn-row"><button class="btn" data-act="lock-now">Lock now</button></div>
      </div>`);
  }

  /* ---------------- Events ---------------- */
  function onClick(e) {
    const el = e.target.closest('[data-act], [data-close]');
    if (!el) return;
    if (el.hasAttribute('data-close')) { e.preventDefault(); closeSheet(); return; }
    const act = el.dataset.act;
    const id = el.dataset.id;
    const find = (col) => D[col].find((r) => r.id === id);

    switch (act) {
      case 'edit': e.preventDefault(); openEditor(el.dataset.col, id); break;
      case 'book': e.preventDefault(); openBooking(el.dataset.col, id); break;
      case 'add': {
        e.preventDefault();
        const col = el.dataset.col;
        const def = {};
        if (col === 'hotels') Object.assign(def, { legId: el.dataset.leg });
        if (col === 'activities') Object.assign(def, { legId: el.dataset.leg || (legFor(el.dataset.date || '') || legs()[0] || {}).id, status: 'idea', date: el.dataset.date || '' });
        if (col === 'transport') Object.assign(def, { date: el.dataset.date || todayISO(), mode: 'flight', status: 'to-book', budgetCat: 'FLIGHTS' });
        if (col === 'expenses') Object.assign(def, { date: el.dataset.date || todayISO(), category: el.dataset.cat || 'OTHER' });
        if (col === 'legs') { const last = legs().slice(-1)[0]; Object.assign(def, { checkIn: last ? last.checkOut : D.meta.start, checkOut: last ? addDays(last.checkOut, 1) : D.meta.start, country: last ? last.country : '' }); }
        openEditor(col, null, def);
        break;
      }
      case 'spend': e.preventDefault(); openSheet('Log spending', spendFormHTML('spendSheet', { date: el.dataset.date, cat: el.dataset.cat })); break;
      case 'delete': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Tap again to delete'; return; }
        const form = $('#editForm');
        removeRec(form.dataset.col, form.dataset.id);
        closeSheet(); render();
        break;
      }
      case 'lock': {
        const h = find('hotels');
        D.hotels.filter((x) => x.legId === h.legId && x.locked).forEach((x) => { x.locked = false; touch(x); });
        h.locked = true; touch(h); ui.expanded[h.legId] = false;
        commit(); render(); toast(`Locked in ${h.name}. Add the booking reference once it’s confirmed.`, 3600);
        break;
      }
      case 'unlock': { const h = find('hotels'); h.locked = false; touch(h); commit(); render(); break; }
      case 'expand': ui.expanded[el.dataset.leg] = !ui.expanded[el.dataset.leg]; render(); break;
      case 'goto-leg': {
        e.preventDefault(); closeSheet();
        const l = legById(el.dataset.leg);
        ui.sub.stays = 'all';
        if (ui.tab !== 'stays') { history.pushState(null, '', '#stays'); ui.tab = 'stays'; }
        render();
        requestAnimationFrame(() => { const t = document.getElementById(`leg-${el.dataset.leg}`); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        void l;
        break;
      }
      case 'goto-day': {
        e.preventDefault(); closeSheet();
        ui.day = el.dataset.date; ui.homeMode = 'day';
        if (ui.tab !== 'today') history.pushState(null, '', '#today/day'); else history.replaceState(null, '', '#today/day');
        ui.tab = 'today'; render(); window.scrollTo(0, 0);
        break;
      }
      case 'sub': setSub(el.dataset.tab, el.dataset.v); break;
      case 'act-booked': {
        const a = find('activities');
        a.status = isBooked(a) ? 'shortlist' : 'booked'; touch(a); commit(); afterQuickEdit(); break;
      }
      case 'act-ahead': { const a = find('activities'); a.needsBookingAhead = !a.needsBookingAhead; touch(a); commit(); afterQuickEdit(); break; }
      case 'act-short': { const a = find('activities'); a.status = a.status === 'shortlist' ? 'idea' : 'shortlist'; touch(a); commit(); afterQuickEdit(); break; }
      case 'task': { const k = find('tasks'); k.done = !k.done; touch(k); commit(); render(); break; }
      case 'tfilter': ui.sub.tFilter = el.dataset.v; render(); break;
      case 'todo-all': ui.showAllTodo = !ui.showAllTodo; render(); break;
      case 'day': {
        if (el.dataset.date && $('#sheet').open) { openDay(el.dataset.date); break; }
        ui.day = addDays(ui.day || D.meta.start, Number(el.dataset.delta)); ui.homeMode = 'day'; render();
        const b = $('.daybar'); if (b && b.getBoundingClientRect().top <= $('.topbar').offsetHeight + 1) window.scrollTo(0, $('.band').offsetHeight);
        break;
      }
      case 'day-today': ui.day = todayISO(); render(); break;
      case 'open-day': if (e.target.closest('a, input')) return; openDay(el.dataset.date); break;
      case 'edit-fx': {
        const fx = D.meta.fx;
        openSheet('Planning exchange rates', `<form class="form" id="fxForm">${Object.keys(fx).map((k) => `<div class="field half"><label for="fx-${k}">£1 in ${k}</label><input id="fx-${k}" name="${k}" inputmode="decimal" value="${esc(fx[k])}"></div>`).join('')}
          <div class="form-actions"><button class="btn btn-fill" type="submit">Save</button><button class="btn btn-quiet" type="button" data-close>Cancel</button></div></form>`);
        break;
      }
      case 'sync-info': {
        const s = syncState();
        if (Store.token && !saving) { toast(`${s.txt}. Checking for changes…`); pull(false); } else toast(s.tip, 4200);
        break;
      }
      case 'sync-now': pull(false); break;
      case 'clear-token': Store.clearToken(); setSync(); openSettings(); toast('Token removed from this device'); break;
      case 'export': {
        const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `honeymoon-backup-${todayISO()}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case 'download-enc': Store.downloadCipher(); break;
      case 'lock-now': lockApp(); break;
      default: break;
    }
  }

  function afterQuickEdit() {
    if ($('#sheet').open) {
      if (ui.sheetDay) { const d = ui.sheetDay; openDay(d); }
      safeRender.pending = true;
    } else render();
  }

  async function onSubmit(e) {
    const f = e.target;
    if (f.id === 'editForm') { e.preventDefault(); submitEditor(f); return; }
    if (f.id === 'bookForm') { e.preventDefault(); submitBooking(f); return; }
    if (f.dataset.spend) { e.preventDefault(); submitSpend(f); return; }
    if (f.id === 'fxForm') {
      e.preventDefault();
      Object.keys(D.meta.fx).forEach((k) => { const v = num(f.elements[k].value); if (v > 0) D.meta.fx[k] = v; });
      D.meta.updatedAt = Date.now(); commit(); closeSheet(); render();
      return;
    }
    if (f.id === 'repoForm') {
      e.preventDefault();
      const repo = { owner: $('#rOwner').value.trim(), name: $('#rName').value.trim(), branch: $('#rBranch').value.trim() || 'main' };
      if (!repo.owner || !repo.name) { toast('Enter the owner and repository name'); return; }
      Store.setRepo(repo);
      const tok = $('#rToken').value.trim();
      if (tok) {
        try { await Store.testToken(tok); await Store.storeToken(tok); toast('Token saved. This device can now make changes.'); pull(true); }
        catch (err) { toast(err.message, 5000); return; }
      } else toast('Saved');
      setSync(); openSettings();
      return;
    }
    if (f.id === 'passForm') {
      e.preventDefault();
      const a = $('#np1').value, b = $('#np2').value;
      if (a !== b) { toast('The passphrases don’t match'); return; }
      if (!Store.passphraseOk(a)) { toast('Use at least 4 words or 16 characters'); return; }
      try { await flush(); await Store.changePassphrase(a, D); toast('Passphrase changed'); closeSheet(); }
      catch (err) { toast(err.message, 5000); }
    }
  }

  function onChange(e) {
    const el = e.target;
    if (el.id === 'idleSel') { try { localStorage.setItem('hm.idle', el.value); } catch (x) { /* ignore */ } toast('Saved'); return; }
    if (el.id === 'importFile' && el.files[0]) {
      el.files[0].text().then((txt) => {
        const data = normalize(JSON.parse(txt));
        if (!data.legs.length) throw new Error('That file has no trip data');
        COLS.forEach((c) => data[c].forEach(touch));
        data.meta.updatedAt = Date.now();
        D = data; commit(); closeSheet(); render(); toast('Imported');
      }).catch((err) => toast(`Import failed: ${err.message}`, 5000));
    }
  }

  const noteTimers = {};
  function saveNote(date, text) {
    let n = noteFor(date);
    if (!n) { n = { id: `N-${date}`, date, text: '' }; D.notes.push(n); }
    if (n.text === text) return;
    n.text = text; touch(n); commit();
    $$(`[data-note-state="${date}"]`).forEach((s) => { s.textContent = Store.canWrite ? 'Saved' : 'Not saved: read-only on this device'; });
    if ($('#sheet').open) safeRender.pending = true;
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'fxAmt' || t.id === 'fxCur') {
      const amt = num($('#fxAmt').value), cur = $('#fxCur').value;
      $('#fxOut').textContent = `£${toGBP(amt, cur).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
      return;
    }
    if (t.dataset && t.dataset.note) {
      const d = t.dataset.note;
      $$(`[data-note-state="${d}"]`).forEach((s) => { s.textContent = 'Typing…'; });
      clearTimeout(noteTimers[d]); noteTimers[d] = setTimeout(() => saveNote(d, t.value), 700);
      return;
    }
    const form = t.closest('form[data-spend]');
    if (form) {
      const amt = num(form.elements.amount.value), cur = form.elements.cur.value;
      const out = $('[data-conv]', form);
      if (out) out.textContent = amt ? (cur === 'GBP' ? `${money(amt)}, logged as paid.` : `About £${toGBP(amt, cur).toLocaleString('en-GB', { maximumFractionDigits: 2 })} at ${D.meta.fx[cur]} ${cur} to £1, logged as paid.`) : 'Logged as paid, in pounds at your planning rates.';
    }
  }

  /* ---------------- Lock / idle ---------------- */
  let lastAct = Date.now();
  async function lockApp() {
    try { if (dirty) await flush(); } catch (e) { /* best effort */ }
    Store.lock(); D = null;
    location.reload();
  }
  function checkIdle() {
    const m = idleMinutes();
    if (D && m > 0 && Date.now() - lastAct > m * 60000) lockApp();
  }

  /* ---------------- Start-up ---------------- */
  function start(data) {
    D = normalize(data);
    $('#gate').hidden = true;
    $('#app').hidden = false;
    route();
    if (Store.token) pull(true);
    setInterval(() => { if (document.visibilityState === 'visible') pull(true); }, 60000);
    setInterval(checkIdle, 30000);
  }

  function showGateForm(which) {
    $('#gateLoading').hidden = true;
    $('#unlockForm').hidden = which !== 'unlock';
    $('#setupForm').hidden = which !== 'setup';
    if (which === 'unlock') setTimeout(() => $('#pass').focus(), 50);
    if (which === 'setup') {
      const r = Store.repo;
      $('#sRepo').value = r ? `${r.owner}/${r.name}` : '';
      if (Store.isLocalHost()) $('#sRepo').placeholder = 'Leave blank for local test mode';
    }
  }

  async function init() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    // Ask the browser not to evict our storage (saved token + offline copy) when the device is low on space.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.aday')) { e.preventDefault(); openDay(e.target.dataset.date); }
      // In sheet forms, Enter in a field shouldn't submit and close the sheet; only the Save button does.
      // (Textareas still get new lines; buttons still activate with Enter.)
      if (e.key === 'Enter' && e.target.matches('input, select') && e.target.closest('#sheet form')) e.preventDefault();
    });
    $('#view').addEventListener('focusout', (e) => {
      if (e.target.dataset && e.target.dataset.note) { const d = e.target.dataset.note; clearTimeout(noteTimers[d]); saveNote(d, e.target.value); }
      if (renderPending) setTimeout(() => { if (renderPending && !(document.activeElement && document.activeElement.closest('#view') && document.activeElement.matches('input, textarea, select'))) render(); }, 0);
    });
    ['pointerdown', 'keydown', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkIdle(); pull(true); } });
    window.addEventListener('hashchange', route);
    window.addEventListener('online', () => { setSync(); if (dirty) flush(); });
    window.addEventListener('offline', setSync);
    window.addEventListener('beforeunload', (e) => { if (dirty && D) { flush(); e.preventDefault(); e.returnValue = ''; } });
    $('#sheet').addEventListener('close', () => { ui.sheetDay = null; if (safeRender.pending) { safeRender.pending = false; render(); } });
    // Only dismiss on a genuine backdrop click: the press must start AND end on the dialog itself.
    // Otherwise a text-selection drag that ends outside the sheet would close it.
    let downOnBackdrop = false;
    $('#sheet').addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === $('#sheet'); });
    $('#sheet').addEventListener('click', (e) => {
      if (downOnBackdrop && e.target === $('#sheet')) closeSheet();
      downOnBackdrop = false;
    });
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnLock').addEventListener('click', lockApp);

    $('#unlockForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#gateMsg'); const btn = e.target.querySelector('button');
      msg.textContent = 'Unlocking…'; btn.disabled = true;
      try { const data = await Store.unlock($('#pass').value); $('#pass').value = ''; msg.textContent = ''; start(data); }
      catch (err) { msg.textContent = err.code === 'pass' ? 'That passphrase didn’t work. Check it and try again.' : err.message; }
      btn.disabled = false;
    });

    $('#setupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#setupMsg');
      const p1 = $('#sPass').value, p2 = $('#sPass2').value;
      if (p1 !== p2) { msg.textContent = 'The passphrases don’t match.'; return; }
      if (!Store.passphraseOk(p1)) { msg.textContent = 'Use at least 4 words or 16 characters.'; return; }
      let seed;
      try { seed = normalize(JSON.parse(await $('#sSeed').files[0].text())); if (!seed.legs.length) throw new Error('no legs'); }
      catch (err) { msg.textContent = 'That trip data file could not be read.'; return; }
      const repoTxt = $('#sRepo').value.trim();
      const token = $('#sToken').value.trim();
      let repo = null;
      if (repoTxt) {
        const m = repoTxt.replace(/^https?:\/\/github\.com\//, '').match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
        if (!m) { msg.textContent = 'The repository should look like owner/name.'; return; }
        repo = { owner: m[1], name: m[2], branch: 'main' };
      }
      if (token && !repo) { msg.textContent = 'Enter the repository to use the token with.'; return; }
      msg.textContent = 'Encrypting…';
      try {
        if (token) { Store.setRepo(repo); await Store.testToken(token); }
        await Store.create(p1, seed, token || null, repo);
        if (token || (Store.isLocalHost() && !repo)) { msg.textContent = ''; start(seed); return; }
        Store.downloadCipher();
        msg.textContent = 'Downloaded data.enc.json. Upload it to the root of your repository, wait a minute, then reload this page.';
      } catch (err) { msg.textContent = err.message; }
    });

    try {
      const f = await Store.loadPublic();
      showGateForm(f ? 'unlock' : 'setup');
    } catch (err) {
      $('#gateLoading').textContent = err.message;
    }
  }

  init();
})();
