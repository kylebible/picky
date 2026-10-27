import { useSyncExternalStore } from "react";
import { EMPTY_PROFILE, type Profile } from "../../shared/profile";

// The profile lives in localStorage until Google sign-in saves it to D1.
// `null` means the person hasn't been through setup yet.

const KEY = "picky.profile";
const listeners = new Set<() => void>();

function load(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_PROFILE, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

let profile = load();

export function useProfile() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => profile,
  );
}

export function saveProfile(next: Profile) {
  profile = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Blocked storage: the profile still applies until the page reloads.
  }
  listeners.forEach((l) => l());
}
