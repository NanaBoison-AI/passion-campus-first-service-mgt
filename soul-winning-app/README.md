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
- **Hidden admin tools:** tap the big total **10 times** (taps must be within 2.5 s of each other).
  Three buttons appear (and stay on that phone):
  - **View All Souls Won** — everyone's souls (not just this phone's), newest first, with "Recorded by".
    Search matches the soul's name, phone, location **and the name of the person who recorded it**; the
    "Showing X of Y" line gives that person's total. Outside additions appear too (no call/map buttons).
    The data is held in memory only (nothing is saved on the phone) and is gone after a reload or leaving the app.
  - **Add Outside Souls** — enter a number of souls won outside the app (plus an optional note).
    It is added to the total everyone sees. Use a negative number to correct a mistake.
  - **Export CSV** — downloads every soul and every outside addition.
  All three ask for the admin email/password each time.

## Configuration values

There is **no build step, so no Cloudflare Pages environment variables are used or needed.**
Everything below is plain config that you paste into a file once. None of it is a secret
(the Firebase web config ships to every browser by design; access is enforced by `firestore.rules`).

### 1. Firebase web config -> `firebase-config.js`

From Firebase console -> Project settings -> Your apps -> Web app -> SDK setup and configuration:

| Key in `firebase-config.js` | Firebase value | Required |
| --- | --- | --- |
| `apiKey` | `apiKey` | yes |
| `authDomain` | `authDomain` (`<project-id>.firebaseapp.com`) | yes (used by the admin sign-in for the export) |
| `projectId` | `projectId` | yes (the app stays in phone-only mode while this is still `YOUR_PROJECT_ID`) |
| `appId` | `appId` | yes |

`storageBucket`, `messagingSenderId` and `measurementId` are not used by this app.

### 2. Admin UID -> `firestore.rules`

| Placeholder | Where to get it |
| --- | --- |
| `REPLACE_WITH_ADMIN_UID` (in `isAdmin()`) | Firebase console -> Authentication -> Users -> the admin user's **User UID** |

The admin email and password are **not stored anywhere in the code**. You type them into the hidden
export dialog each time.

### 3. Firebase services that must be enabled

- **Firestore Database** (production mode). Collections are created automatically on first write:
  `souls/{uuid}`, `outside/{uuid}` (admin's outside-the-app additions) and `stats/total`.
- **Authentication -> Email/Password** provider, with one user (the admin). Recommended: turn off
  "Enable create (sign-up)" so nobody else can register.
- Publish `firestore.rules` after filling in the admin UID.

### 4. Cloudflare Pages settings (no env vars)

| Setting | Value |
| --- | --- |
| Production branch | `pc-soul-winning` |
| Framework preset | None |
| Build command | *(empty)* |
| Build output directory | `soul-winning-app` |
| Root directory | *(repo root)* |
| Environment variables | *(none)* |

Install on a phone from the `*.pages.dev` URL: Android Chrome -> **Install app**;
iPhone Safari -> Share -> **Add to Home Screen**.

If you later want these values to come from Pages environment variables instead of being committed,
that needs a small build step to generate `firebase-config.js`; say so and it can be added.

## Notes & limits

- The total is a counter document (`stats/total`) incremented together with each soul, so reading it
  costs one read no matter how many souls exist. Because there's no login, the rules can't stop a
  determined person from bumping it; the CSV export (real data) is the source of truth.
- **CSV export:** one row per soul (`Count` = 1) plus one row per outside addition (`Name` = "Outside the app",
  `Count` = the amount, note in `Location`). The `Count` column adds up to the total on the home screen.
- Outside additions are saved in the same step as the total update, and each has a unique id, so a retry after
  a dropped connection can't add the amount twice. They can't be edited; to fix a mistake, add a negative amount.
- If you already published `firestore.rules`, **publish the updated version** — the admin outside-souls feature
  needs the new `outside` and `stats/total` rules.
- Entries can't be edited or deleted in the app (the local list and the server would drift apart).
- Normal edits are picked up automatically (the service worker is network-first). Only bump `CACHE`
  in `sw.js` if you add or remove files in its `SHELL` list.
- Run locally: `npx http-server soul-winning-app -c-1` then open http://localhost:8080
  (the service worker and install prompt work on `localhost` and HTTPS only).
