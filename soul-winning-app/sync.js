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

/** Admin-only: sign in and fetch every soul. Used by the hidden CSV export. */
export async function fetchAllSouls(email, password) {
  const { app, db, fs } = await init();
  const auth = await import(SDK + "firebase-auth.js");
  const a = auth.getAuth(app);
  await auth.signInWithEmailAndPassword(a, email, password);
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, "souls"), fs.orderBy("createdAt")));
    return snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name,
        phone: x.phone,
        location: x.location,
        mapLink: x.mapLink,
        recordedBy: x.recordedBy,
        capturedAt: x.capturedAt,
        savedAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate().toISOString() : "",
      };
    });
  } finally {
    await auth.signOut(a);
  }
}
