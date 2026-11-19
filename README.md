# Honeymoon planner

A private, encrypted trip planner hosted on GitHub Pages. All trip data lives in `data.enc.json`, encrypted with AES-256-GCM under a passphrase (PBKDF2-SHA256, 600,000 iterations). The repo is public, but it only ever contains ciphertext.

`private/seed.json` holds the pre-filled plan in plain text. It is in `.gitignore` and **must never be committed**.

## One-time setup

1. **Create the repo.** Make a new GitHub repository, e.g. `honeymoon`. Give it a non-identifying name: the name is public.
2. **Push these files.** From this folder:
   ```
   git add .
   git commit -m "Honeymoon planner"
   git remote add origin https://github.com/<you>/honeymoon.git
   git push -u origin main
   ```
   Check first that `git status` does **not** list `private/`.
3. **Turn on Pages.** In the repo, go to Settings → Pages → Source: *Deploy from a branch* → `main` / root. After a minute the site is at `https://<you>.github.io/honeymoon/`.
4. **Create a token.** Go to GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
   - Repository access: *Only select repositories* → `honeymoon`
   - Permissions → Repository → **Contents: Read and write** (nothing else)
   - Set an expiry after the trip, e.g. 31 March 2027.
5. **First run.** Open the site. It shows *First-time setup*:
   - Choose a long passphrase (4+ random words). There is no recovery if it's forgotten.
   - Trip data file: pick `private/seed.json` from this folder.
   - Repository: `<you>/honeymoon`. Token: paste the token from step 4.
   - Click **Encrypt and create**. This commits `data.enc.json` to the repo.

## Adding your wife's phone or laptop

Open the site, enter the passphrase, then go to **Settings (⚙) → GitHub → paste a token → Save**. The token is stored on that device encrypted under the passphrase. Without a token a device can still *read* the plan, but can't save changes.

Either reuse the same token or make her a second one with the same settings. Send it privately: in person, or through a password manager. On phones, use *Share → Add to Home Screen* for an app-like icon.

## The sections

- **Home**: before the trip, what's still to book, most urgent first, with *Mark booked* on each item. During the trip it opens on **Today**: tonight's hotel (ref, address, directions, call), today's travel with times, plans, notes and *Log spending*.
- **Itinerary**: every day of the trip, a month calendar, and **Journeys** (all flights, trains and transfers).
- **Stays**: compare the options for each stop, lock one in, then add the booking details.
- **Activities**: ideas per stop; shortlist, flag *book ahead*, mark booked.
- **Budget**: where the money stands, a spending log (enter amounts in local currency; they convert to pounds), and a currency converter.

Each country can have a header photo, a calendar colour and a local currency: tap *Add photo* on a header, or go to Settings → Country photos and colours. Photo links are stored inside the encrypted plan, not in the repo.

## Day to day

- **Sync.** Edits save automatically a couple of seconds after you make them, as an encrypted commit. Each device checks for the other's changes every minute and when the app is reopened. If you both edit at once, the changes are merged record by record.
- **Offline.** Once a device has opened the plan, it keeps the encrypted copy. While travelling, the plan still unlocks without signal. Edits made offline save when you're back online, as long as the page stays open.
- **Locking.** Use the padlock button, or the plan locks itself after a period of inactivity (default 1 hour; change it in Settings).
- **Backup.** Settings → Export JSON saves an **unencrypted** backup. Keep it private.

## Security notes

- The passphrase is the whole defence, because anyone can download the ciphertext. Use 4+ random words, not names or dates.
- The token can only touch this one repo. If a device is lost, revoke the token on GitHub and make a new one.
- Changing the passphrase (Settings) re-encrypts everything. The other device just needs the new passphrase next time.

## Local testing

Run `python -m http.server 8765` and open http://127.0.0.1:8765/. With no repo configured, the app runs in *local test mode* and saves into the browser only. Adding `?today=2027-01-11` to the URL previews the in-trip "Today" screen for that date.
