/**
 * Attendance data access (Firestore).
 *
 * Model:  groups/{groupId}/attendance/{yyyy-MM-dd}
 *   { date, present: [memberId], count, serviceType, updatedAt, note }
 *
 * "Present" is the list of member ids marked present for that service date.
 * Absentees are derived by diffing against the group's member list (Sheets).
 * serviceType labels the service; records saved before this field existed
 * default to 'Sunday Service' on read.
 */

const DEFAULT_SERVICE_TYPE = 'Sunday Service';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy
} from 'firebase/firestore';
import { db } from './firebase.js';

const col = (groupId) => collection(db(), 'groups', String(groupId), 'attendance');
const ref = (groupId, date) => doc(db(), 'groups', String(groupId), 'attendance', date);

/** One service date. Returns { date, present:[], count, serviceType } (empty if none). */
export async function getService(groupId, date) {
  const snap = await getDoc(ref(groupId, date));
  if (!snap.exists()) {
    return { date, present: [], count: 0, serviceType: DEFAULT_SERVICE_TYPE, exists: false };
  }
  const d = snap.data();
  return {
    date,
    present: d.present || [],
    count: d.count ?? (d.present || []).length,
    serviceType: d.serviceType || DEFAULT_SERVICE_TYPE,
    note: d.note || '',
    exists: true
  };
}

/** Create/replace the present list for a service date. */
export async function saveService(groupId, date, presentIds, serviceType = DEFAULT_SERVICE_TYPE, note = '') {
  const present = Array.from(new Set(presentIds));
  await setDoc(ref(groupId, date), {
    date,
    present,
    count: present.length,
    serviceType: serviceType || DEFAULT_SERVICE_TYPE,
    note,
    updatedAt: new Date().toISOString()
  });
  return { date, present, count: present.length, serviceType };
}

export async function deleteService(groupId, date) {
  await deleteDoc(ref(groupId, date));
}

/** All service docs in [start, end] (inclusive), ascending by date. */
export async function listServices(groupId, start, end) {
  const clauses = [];
  if (start) clauses.push(where('date', '>=', start));
  if (end) clauses.push(where('date', '<=', end));
  const q = clauses.length
    ? query(col(groupId), ...clauses, orderBy('date', 'asc'))
    : query(col(groupId), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((s) => {
    const d = s.data();
    return {
      date: d.date || s.id,
      present: d.present || [],
      count: d.count ?? (d.present || []).length,
      serviceType: d.serviceType || DEFAULT_SERVICE_TYPE
    };
  });
}
