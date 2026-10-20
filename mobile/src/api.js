import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_KEYS = {
  BASE_URL: 'iss_api_base_url',
  AUTH_TOKEN: 'iss_auth_token',
  USER_DATA: 'iss_user_data',
  ACADEMY_SLUG: 'iss_academy_slug',
  ACTIVE_SCREEN: 'iss_active_screen',
  BOTTOM_OFFSET: 'iss_bottom_offset',
};

async function getItem(key) {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    return null;
  }
}

async function setItem(key, value) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (e) {}
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {}
}

async function deleteItem(key) {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch (e) {}
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {}
}

let cachedBaseUrl = null;
let cachedSlug = null;
let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

export function getDefaultHost() {
  if (Platform.OS === 'web') {
    return 'http://localhost:3005';
  }
  // User's active LAN Wi-Fi IP for direct physical Android phone verification
  return 'http://192.168.29.75:3005';
}

export async function getApiUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const stored = await getItem(SECURE_STORE_KEYS.BASE_URL);
    cachedBaseUrl = stored || getDefaultHost();
    return cachedBaseUrl;
  } catch (e) {
    return getDefaultHost();
  }
}

export async function setApiUrl(url) {
  cachedBaseUrl = url;
  await setItem(SECURE_STORE_KEYS.BASE_URL, url);
}

export async function getStoredSlug() {
  if (cachedSlug) return cachedSlug;
  try {
    cachedSlug = await getItem(SECURE_STORE_KEYS.ACADEMY_SLUG);
    return cachedSlug || 'pratik-karate-academy';
  } catch (e) {
    return 'pratik-karate-academy';
  }
}

export async function setStoredSlug(slug) {
  cachedSlug = slug;
  if (slug) {
    await setItem(SECURE_STORE_KEYS.ACADEMY_SLUG, slug);
  } else {
    await deleteItem(SECURE_STORE_KEYS.ACADEMY_SLUG);
  }
}

export async function getStoredToken() {
  return await getItem(SECURE_STORE_KEYS.AUTH_TOKEN);
}

export async function setStoredToken(token) {
  if (token) {
    await setItem(SECURE_STORE_KEYS.AUTH_TOKEN, token);
  } else {
    await deleteItem(SECURE_STORE_KEYS.AUTH_TOKEN);
  }
}

export async function getStoredUser() {
  try {
    const raw = await getItem(SECURE_STORE_KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function setStoredUser(user) {
  if (user) {
    await setItem(SECURE_STORE_KEYS.USER_DATA, JSON.stringify(user));
  } else {
    await deleteItem(SECURE_STORE_KEYS.USER_DATA);
  }
}

export async function getStoredScreen() {
  return await getItem(SECURE_STORE_KEYS.ACTIVE_SCREEN);
}

export async function setStoredScreen(screenName) {
  if (screenName) {
    await setItem(SECURE_STORE_KEYS.ACTIVE_SCREEN, screenName);
  } else {
    await deleteItem(SECURE_STORE_KEYS.ACTIVE_SCREEN);
  }
}

export async function clearSession() {
  cachedBaseUrl = null;
  cachedSlug = null;
  await deleteItem(SECURE_STORE_KEYS.AUTH_TOKEN);
  await deleteItem(SECURE_STORE_KEYS.USER_DATA);
  await deleteItem(SECURE_STORE_KEYS.ACTIVE_SCREEN);
}

/**
 * Core API caller with automatic authorization headers and multi-tenant scoping
 */
export async function api(method, path, body = undefined, overrideSlug = null) {
  const baseUrl = await getApiUrl();
  const token = await getStoredToken();
  const slug = overrideSlug || await getStoredSlug();

  const opts = {
    method,
    headers: {},
  };

  if (slug) {
    opts.headers['X-Tenant-Id'] = slug;
  }

  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const res = await fetch(url, opts);

  if (res.status === 401 && path !== '/api/auth/login') {
    await clearSession();
    if (sessionExpiredHandler) sessionExpiredHandler();
    throw new Error('Session expired. Please log in again.');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed with status ${res.status}`);
  }

  return data;
}

export function formatCurrency(amount) {
  const num = Number(amount || 0);
  return `₹${num.toLocaleString('en-IN')}`;
}

let cachedBottomOffset = null;

export async function getStoredBottomOffset() {
  if (cachedBottomOffset !== null) return cachedBottomOffset;
  try {
    const stored = await getItem(SECURE_STORE_KEYS.BOTTOM_OFFSET);
    if (stored !== null && !isNaN(Number(stored))) {
      cachedBottomOffset = Number(stored);
      return cachedBottomOffset;
    }
  } catch (e) {}
  // Default offset: 28px on Android to comfortably clear 3-button system navigation bar
  cachedBottomOffset = Platform.OS === 'android' ? 28 : 12;
  return cachedBottomOffset;
}

export async function setStoredBottomOffset(offset) {
  const num = Number(offset || 0);
  cachedBottomOffset = num;
  await setItem(SECURE_STORE_KEYS.BOTTOM_OFFSET, String(num));
}
