/** Firebase app + Firestore + Auth singletons. Web config from Vite env vars. */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let _app = null, _db = null, _auth = null;

function app() {
  if (!_app) {
    if (!config.projectId) throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.');
    _app = initializeApp(config);
  }
  return _app;
}

export function db() { if (!_db) _db = getFirestore(app()); return _db; }
export function auth() { if (!_auth) _auth = getAuth(app()); return _auth; }
