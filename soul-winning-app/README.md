# Soul Winning Tracker — First Love Church - Passion Campus

A tiny installable phone app (PWA) for recording souls won. No login, no build step —
plain HTML/CSS/JS served as static files, with **Firebase Firestore** as the database.

- **Home:** one big number — total souls won across *everyone*, live.
- **Add soul won:** name, phone, optional location text, optional Google Maps link. The recorder's
  name (asked once on first open) is saved with every entry.
- **Review souls won:** the user's *own* list (stored on their phone), with search, a call button,
  and a map button when a location was entered.
- **Offline-safe:** every entry is saved on the phone first, then uploaded. If there's no signal it
  is uploaded automatically later ("n waiting to upload" is shown). Retrying never double-counts.
- **Hidden CSV export:** tap the big total **10 times** (taps must be within 2.5 s of each other).
  An *Export CSV* button appears (and stays on that phone). It asks for the admin email/password
  and downloads every soul as a CSV.

## 1. Set up Firebase (one time)

1. [Firebase console](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** (production mode, pick a region near you).
3. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
   Then **Users → Add user** with the email/password *you* will use for the export.
   Copy that user's **User UID**.
   (Optional but recommended: Authentication → Settings → User actions → turn **off** "Enable create (sign-up)".)
4. **Firestore → Rules:** paste the contents of [`firestore.rules`](./firestore.rules), replace
   `REPLACE_WITH_ADMIN_UID` with the UID from step 3, and **Publish**.
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app, then copy the
   `firebaseConfig` values into [`firebase-config.js`](./firebase-config.js).

Why the admin sign-in? There's no login for normal users, so the database rules are what keep
everyone's names and phone numbers private: the app can *add* souls and read the total, but only
the admin account can *list* the souls. Without this, anyone who opened the page source could
download every phone number.

## 2. Deploy on Cloudflare Pages

1. Push this branch to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Settings:
   - **Production branch:** `pc-soul-winning`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `soul-winning-app`
4. Deploy. Open the `*.pages.dev` URL on a phone:
   - **Android (Chrome):** tap **Install app** on the home screen (or menu → *Install app*).
   - **iPhone (Safari):** Share → **Add to Home Screen**.

## Notes & limits

- The total is a counter document (`stats/total`) incremented together with each soul, so reading it
  costs one read no matter how many souls exist. Because there's no login, the rules can't stop a
  determined person from bumping it; the CSV export (real data) is the source of truth.
- Entries can't be edited or deleted in the app (the local list and the server would drift apart).
- Normal edits are picked up automatically (the service worker is network-first). Only bump `CACHE`
  in `sw.js` if you add or remove files in its `SHELL` list.
- Run locally: `npx http-server soul-winning-app -c-1` then open http://localhost:8080
  (the service worker and install prompt work on `localhost` and HTTPS only).
