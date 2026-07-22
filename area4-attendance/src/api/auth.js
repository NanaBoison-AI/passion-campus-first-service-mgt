/**
 * Username + password auth on top of Firebase Email/Password.
 *
 * Users log in with a plain username (e.g. "area4admin"). Behind the scenes it
 * maps to an email `${username}@${VITE_AUTH_EMAIL_DOMAIN}` so Firebase Auth can
 * store it. Accounts are created by the admin in the Firebase console (there is
 * no public sign-up). If someone types a full email (contains "@") it is used
 * as-is.
 */
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword
} from 'firebase/auth';
import { auth } from './firebase.js';

const DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'area4.app';

export function usernameToEmail(username) {
  const u = String(username || '').trim();
  return u.includes('@') ? u : `${u.toLowerCase()}@${DOMAIN}`;
}

export function signIn(username, password) {
  return signInWithEmailAndPassword(auth(), usernameToEmail(username), password);
}

export const signOutUser = () => signOut(auth());
export const onAuth = (cb) => onAuthStateChanged(auth(), cb);
export const currentUser = () => auth().currentUser;
export const changePassword = (newPassword) => updatePassword(auth().currentUser, newPassword);

/** Fresh ID token for authenticating calls to our Sheets proxy (or null). */
export async function idToken() {
  const u = auth().currentUser;
  return u ? u.getIdToken() : null;
}

/** Turn a Firebase auth error into a friendly message. */
export function authErrorMessage(err) {
  const code = err && err.code ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect username or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a moment.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return (err && err.message) || 'Sign-in failed.';
  }
}
