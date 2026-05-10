type SecureStoreModule = typeof import('expo-secure-store');

export interface StoredSession {
  accessToken: string;
  accessTokenExpiresAt?: string;
  refreshToken: string;
  refreshTokenExpiresAt?: string;
}

const sessionKey = 'homeapp.session.v1';
const rememberedEmailKey = 'homeapp.remembered-email.v1';

async function getSecureStore(): Promise<SecureStoreModule | null> {
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function readItem(key: string): Promise<string | null> {
  const secureStore = await getSecureStore();

  if (!secureStore) {
    return null;
  }

  try {
    return await secureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  const secureStore = await getSecureStore();

  if (!secureStore) {
    return;
  }

  try {
    await secureStore.setItemAsync(key, value);
  } catch {
    // The dev client may not include the native module until Android is rebuilt.
  }
}

async function deleteItem(key: string): Promise<void> {
  const secureStore = await getSecureStore();

  if (!secureStore) {
    return;
  }

  try {
    await secureStore.deleteItemAsync(key);
  } catch {
    // The dev client may not include the native module until Android is rebuilt.
  }
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const rawSession = await readItem(sessionKey);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    await deleteItem(sessionKey);
    return null;
  }
}

export function saveStoredSession(session: StoredSession): Promise<void> {
  return writeItem(sessionKey, JSON.stringify(session));
}

export function clearStoredSession(): Promise<void> {
  return deleteItem(sessionKey);
}

export function loadRememberedEmail(): Promise<string | null> {
  return readItem(rememberedEmailKey);
}

export function saveRememberedEmail(email: string): Promise<void> {
  return writeItem(rememberedEmailKey, email);
}

export function clearRememberedEmail(): Promise<void> {
  return deleteItem(rememberedEmailKey);
}

export async function loadStoredJson<T>(key: string): Promise<T | null> {
  const rawValue = await readItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    await deleteItem(key);
    return null;
  }
}

export function saveStoredJson<T>(key: string, value: T): Promise<void> {
  return writeItem(key, JSON.stringify(value));
}

export function clearStoredItem(key: string): Promise<void> {
  return deleteItem(key);
}
