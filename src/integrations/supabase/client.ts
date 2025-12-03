import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const resolvedSupabaseUrl =
  SUPABASE_URL && SUPABASE_URL.length > 0
    ? SUPABASE_URL
    : SUPABASE_PROJECT_ID && SUPABASE_PROJECT_ID.length > 0
      ? `https://${SUPABASE_PROJECT_ID}.supabase.co`
      : undefined;

if (!resolvedSupabaseUrl) {
  throw new Error("Supabase URL is not configured. Set VITE_SUPABASE_URL or provide VITE_SUPABASE_PROJECT_ID.");
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase publishable key is not configured. Set VITE_SUPABASE_PUBLISHABLE_KEY.");
}

const hasBrowserStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const browserStorage = hasBrowserStorage ? window.localStorage : undefined;
const SUPABASE_ENV_SIGNATURE_KEY = 'supabase-env-signature';
const SUPABASE_ENV_SIGNATURE = `${resolvedSupabaseUrl}:${SUPABASE_PUBLISHABLE_KEY}`;

const collectSupabaseStorageKeys = (storage: Storage) => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (key.startsWith('sb-') || key.startsWith('supabase.auth.') || key === SUPABASE_ENV_SIGNATURE_KEY) {
      keys.push(key);
    }
  }
  return keys;
};

const removeSupabaseSessionEntries = (storage: Storage) => {
  collectSupabaseStorageKeys(storage).forEach((key) => storage.removeItem(key));
};

const ensureEnvironmentSignature = () => {
  if (!browserStorage) return;
  const storedSignature = browserStorage.getItem(SUPABASE_ENV_SIGNATURE_KEY);
  if (storedSignature && storedSignature !== SUPABASE_ENV_SIGNATURE) {
    removeSupabaseSessionEntries(browserStorage);
  }
  browserStorage.setItem(SUPABASE_ENV_SIGNATURE_KEY, SUPABASE_ENV_SIGNATURE);
};

export const clearSupabaseAuthState = () => {
  if (!browserStorage) return;
  removeSupabaseSessionEntries(browserStorage);
  browserStorage.setItem(SUPABASE_ENV_SIGNATURE_KEY, SUPABASE_ENV_SIGNATURE);
};

ensureEnvironmentSignature();

export const supabase = createClient<Database>(resolvedSupabaseUrl, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: browserStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
