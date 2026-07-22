/** In-memory caches so we don't refetch Sheets data on every navigation. */
import { getGroups, getMembers } from '../api/sheets.js';

const cache = {
  groups: null,
  membersByGroup: new Map()
};

export async function loadGroups(force = false) {
  if (!cache.groups || force) cache.groups = await getGroups();
  return cache.groups;
}

export async function getGroup(groupId) {
  const groups = await loadGroups();
  return groups.find((g) => String(g.id) === String(groupId)) || null;
}

export async function loadMembers(groupId, force = false) {
  if (!cache.membersByGroup.has(groupId) || force) {
    cache.membersByGroup.set(groupId, await getMembers(groupId));
  }
  return cache.membersByGroup.get(groupId);
}

export function invalidateMembers(groupId) {
  cache.membersByGroup.delete(groupId);
}
