import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://10.0.2.2:3005'; // Default Android emulator host; use localhost for web

export async function storeAuthToken(token, user) {
  try {
    await SecureStore.setItemAsync('iss_user_token', token);
    await SecureStore.setItemAsync('iss_user_data', JSON.stringify(user));
  } catch (e) {
    console.warn('SecureStore not available or web environment:', e);
  }
}

export async function getAuthToken() {
  try {
    return await SecureStore.getItemAsync('iss_user_token');
  } catch (e) {
    return null;
  }
}

export async function clearAuth() {
  try {
    await SecureStore.deleteItemAsync('iss_user_token');
    await SecureStore.deleteItemAsync('iss_user_data');
  } catch (e) {
    // ignore
  }
}

export async function mobileApiRequest(endpoint, method = 'GET', body = null) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  return await response.json();
}
