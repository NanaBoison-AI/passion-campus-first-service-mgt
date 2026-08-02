# Area 4 · Membership & Attendance

A mobile-first, minimalist web app to manage **church group memberships** and
**attendance** for the groups under *Area 4*.

- **Groups + membership data** lives in **Google Sheets** — one master *groups
  registry* sheet, and **one separate members sheet per group** (each managed by
  a different person). Exposed to the app via a tiny **Apps Script JSON API**.
- **Attendance data** lives in **Firebase Firestore** (easy to review & update).
- The **frontend** is a static **Vite** app hosted on **Cloudflare Pages**, with
  a Cloudflare **Pages Function** proxying the Sheets API (so there's no CORS and
  the Apps Script URL stays server-side).

```
 Browser (Cloudflare Pages, Vite SPA)
   ├── /api/sheets  ──►  Pages Function  ──►  Apps Script Web App  ──►  Google Sheets
   │                                                                   (GROUPS, MEMBERS)
   └── Firebase JS SDK  ──►  Firestore  (groups/{id}/attendance/{date})
```

## User flow

1. Open the app → **list of groups** under Area 4 (from the Sheet).
2. Tap a group → **group dashboard** with four actions:
   - **Memberships** — create & update members (no delete).
   - **Record** — pick a date, tap a checklist of members, save.
   - **Review** — present/absent counts, %, the actual people, and **CSV export**
     (single date *or* a date range).
   - **Graphs** — total attendance per day for a date range; average monthly
     attendance for a given year.

---

## Project layout

```
area4-attendance/
├── index.html
├── vite.config.js            # dev proxy /api/sheets → Apps Script
├── .env.example              # copy to .env for local dev
├── firestore.rules           # Firestore security rules (open + recommended)
├── public/
│   ├── favicon.svg
│   └── _redirects            # SPA fallback for Cloudflare Pages
├── functions/api/sheets.js   # Cloudflare Pages Function (Sheets proxy)
├── apps-script/
│   ├── Code.gs               # Sheets JSON API (groups/members read+write)
│   └── appsscript.json
└── src/
    ├── main.js               # shell + hash router
    ├── styles.css            # design system (mobile-first, dark-mode aware)
    ├── api/  (sheets, firebase, attendance)
    ├── lib/  (dom, router, ui, store, format, csv)
    └── views/ (groups, dashboard, members, record, review, graphs)
```

## Data model

**Master registry sheet — `GROUPS` tab** (the script is bound to this one)

| GROUP_ID | NAME | DESCRIPTION | LEADER | CONTACT | MEETING_DAY | MEMBERS_SHEET | MEMBERS_TAB |
|----------|------|-------------|--------|---------|-------------|---------------|-------------|

- **MEMBERS_SHEET** — the group's own members spreadsheet: paste its **URL** (or
  id). Each group is a separate file, managed by whoever runs that group.
- **MEMBERS_TAB** — *(optional)* tab name inside that file. Blank → a tab named
  `MEMBERS` if present, else the first tab.

**Each group's own members sheet** — just needs a header row with at least a
`NAME` column. These common headers are auto-detected (case-insensitive), so the
managers can keep their existing layout:

| Field | Accepted header names |
|-------|-----------------------|
| Name | NAME, Full Name, Member |
| Contact | CONTACT, PHONE, MOBILE, TEL |
| Residence | RESIDENCE, ADDRESS, AREA |
| Location (Maps link / lat,lng) | LOCATION, MAP, MAPS, GPS, COORDINATES, GEO *(added automatically when first used)* |
| Gender | GENDER, SEX |
| Status | STATUS |
| Notes | NOTES, REMARKS, COMMENTS |
| Id | MEMBER_ID, ID *(added automatically if missing)* |

> A `MEMBER_ID` column is created and back-filled automatically so members have
> stable ids for attendance — **the deploying account needs edit access** to each
> group's sheet.

**Firestore** — `groups/{groupId}/attendance/{yyyy-MM-dd}`
```json
{ "date": "2026-06-14", "present": ["MEM-ab12cd34", "..."], "count": 12, "updatedAt": "..." }
```
`present` holds the member ids marked present; absentees are derived by diffing
against the group's member list.

---

## Setup

### 1. Google Sheets + Apps Script API
1. Create the **master registry** Google Sheet (this holds the group list).
2. **Extensions → Apps Script**. Paste `apps-script/Code.gs`, and paste
   `apps-script/appsscript.json` into ⚙️ **Project Settings → Show appsscript.json**.
3. Run the `setupGroupsSheet` function once (creates the `GROUPS` tab with
   headers + two sample rows). Approve the permission prompt — it now asks for
   access to your spreadsheets because it opens each group's separate sheet.
4. For each group, create/keep its **own members spreadsheet**, **share it with
   the deploying Google account (Editor)**, and paste its URL into the group's
   `MEMBERS_SHEET` cell in the `GROUPS` tab. Set `MEMBERS_TAB` if the members
   aren't on a tab named `MEMBERS`/the first tab.
5. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access*
   **Anyone**. Copy the **/exec URL** — that's your `SHEETS_API_URL`.

### 2. Firebase (Firestore + Auth)
1. Create a Firebase project → **Build → Firestore Database → Create** (start in
   production mode).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. Create accounts under **Authentication → Users → Add user**. Use the pseudo
   email `username@<VITE_AUTH_EMAIL_DOMAIN>` (e.g. `area4admin@area4.app`) and a
   password. Users only ever type the **username** part. There is no public
   sign-up — you provision every account here.
4. **Project settings → Your apps → Web app** → copy the SDK config into the
   `VITE_FIREBASE_*` values.
5. Publish the rules from `firestore.rules` (**Firestore → Rules**) — they
   require a signed-in user.

### 3. Local dev
```bash
cd area4-attendance
cp .env.example .env      # fill SHEETS_API_URL + VITE_FIREBASE_*
npm install
npm run dev               # http://localhost:5173  (proxies /api/sheets)
```

### 4. Deploy to Cloudflare Pages
1. Push this repo to GitHub, then in Cloudflare: **Workers & Pages → Create →
   Pages → Connect to Git**.
2. Build settings:
   - **Root directory:** `area4-attendance`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Settings → Environment variables** (Production *and* Preview):
   - `SHEETS_API_URL` = your Apps Script `/exec` URL (used by the Pages Function)
   - `FIREBASE_API_KEY` = same value as `VITE_FIREBASE_API_KEY` — **enables the
     proxy's token check** so member data can't be fetched without logging in.
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
     `VITE_FIREBASE_APP_ID`, `VITE_AREA_LABEL`, `VITE_AUTH_EMAIL_DOMAIN`
4. Add your Pages domain to Firebase **Auth → Settings → Authorized domains**.

`functions/api/sheets.js` is picked up automatically by Pages — no extra config.

---

## Authentication (username + password)

The app is gated by a login screen backed by **Firebase Email/Password** auth:

- Users log in with a plain **username**; the app maps it to
  `username@<VITE_AUTH_EMAIL_DOMAIN>` internally, so nobody types an email.
- **You create every account** in the Firebase console (see setup step 2) — no
  public sign-up.
- Both data paths are protected once configured:
  - **Firestore** (attendance) — rules require `request.auth != null`.
  - **Sheets proxy** (members) — the Pages Function verifies the caller's
    Firebase ID token when `FIREBASE_API_KEY` is set, so member data isn't
    readable without a login either.
- Password resets: change a user's password from **Authentication → Users** (or
  wire the in-app `changePassword` helper to a settings screen).

To restrict further to specific accounts, use the allowlist variant at the
bottom of `firestore.rules`.

## Notes & trade-offs
- **No member deletion** by design — set `STATUS` to *Inactive* instead.
- Bundle is ~135 kB gzipped (Firebase + Chart.js dominate); fine for mobile.
- One attendance record per group per date. Multiple services per day can be
  added later by extending the Firestore doc id (e.g. `date_service`).
