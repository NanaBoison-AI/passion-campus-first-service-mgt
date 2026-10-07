// Firebase (Firestore) layer. Loaded lazily so the app still opens and works offline.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";

export const isConfigured =
  !!firebaseConfig.projectId && !String(firebaseConfig.projectId).startsWith("YOUR_");

let ready = null;

function init() {
  if (!isConfigured) return Promise.reject(new Error("firebase-not-configured"));
  if (!ready) {
    ready = (async () => {
      const [{ initializeApp }, fs] = await Promise.all([
        import(SDK + "firebase-app.js"),
        import(SDK + "firebase-firestore.js"),
      ]);
      const app = initializeApp(firebaseConfig);
      return { app, db: fs.getFirestore(app), fs };
    })();
    ready.catch(() => { ready = null; }); // allow a retry on the next call
  }
  return ready;
}

/** Live total across all users. Calls onTotal(number). Returns an unsubscribe function. */
export async function subscribeTotal(onTotal, onError) {
  const { db, fs } = await init();
  return fs.onSnapshot(
    fs.doc(db, "stats", "total"),
    (snap) => onTotal(snap.exists() ? Number(snap.data().total) || 0 : 0),
    (err) => onError && onError(err)
  );
}

/** Save one soul. Safe to call again for the same entry: it will not be counted twice. */
export async function pushSoul(entry) {
  const { db, fs } = await init();
  await fs.runTransaction(db, async (tx) => {
    const ref = fs.doc(db, "souls", entry.id);
    if ((await tx.get(ref)).exists()) return; // already uploaded earlier
    tx.set(ref, {
      name: entry.name,
      phone: entry.phone,
      location: entry.location,
      mapLink: entry.mapLink,
      recordedBy: entry.recordedBy,
      capturedAt: entry.capturedAt,
      createdAt: fs.serverTimestamp(),
    });
    tx.set(fs.doc(db, "stats", "total"), { total: fs.increment(1) }, { merge: true });
  });
}

/** Sign in as admin, run fn(ctx), then always sign out again. */
async function asAdmin(email, password, fn) {
  const ctx = await init();
  const auth = await import(SDK + "firebase-auth.js");
  const a = auth.getAuth(ctx.app);
  await auth.signInWithEmailAndPassword(a, email, password);
  try {
    return await fn(ctx);
  } finally {
    await auth.signOut(a);
  }
}

const iso = (ts) => (ts && ts.toDate ? ts.toDate().toISOString() : "");

/** Admin-only: every soul plus every "outside the app" addition, oldest first. Used by the CSV export. */
export function fetchAllSouls(email, password) {
  return asAdmin(email, password, async ({ db, fs }) => {
    const [souls, outside] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, "souls"), fs.orderBy("createdAt"))),
      fs.getDocs(fs.query(fs.collection(db, "outside"), fs.orderBy("createdAt"))),
    ]);
    const rows = [
      ...souls.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id, kind: "soul", count: 1, name: x.name, phone: x.phone, location: x.location, mapLink: x.mapLink,
          recordedBy: x.recordedBy, capturedAt: x.capturedAt, savedAt: iso(x.createdAt),
        };
      }),
      ...outside.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id, kind: "outside", count: x.count, name: "Outside the app", phone: "", location: x.note || "", mapLink: "",
          recordedBy: "Admin", capturedAt: "", savedAt: iso(x.createdAt),
        };
      }),
    ];
    return rows.sort((p, q) => p.savedAt.localeCompare(q.savedAt));
  });
}

/**
 * Admin-only: add souls won outside the app to the total (a negative number corrects a mistake).
 * `id` is generated once per submission so retrying after a dropped connection can't count twice.
 */
export function addOutsideCount(email, password, { id, count, note }) {
  return asAdmin(email, password, ({ db, fs }) =>
    fs.runTransaction(db, async (tx) => {
      const ref = fs.doc(db, "outside", id);
      if ((await tx.get(ref)).exists()) return; // already added
      tx.set(ref, { count, note, createdAt: fs.serverTimestamp() });
      tx.set(fs.doc(db, "stats", "total"), { total: fs.increment(count) }, { merge: true });
    })
  );
}
