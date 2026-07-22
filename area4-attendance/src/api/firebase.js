/** Firebase app + Firestore singleton. Web config comes from Vite env vars. */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let _db = null;
export function db() {
  if (!_db) {
    if (!config.projectId) {
      throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.');
    }
    _db = getFirestore(initializeApp(config));
  }
  return _db;
}
