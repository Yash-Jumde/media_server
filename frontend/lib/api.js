const API_BASE = '';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return res;
}

export async function login(password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) throw new Error('Invalid password');

  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function fetchMedia() {
  const res = await apiFetch('/api/media');
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.json();
}

export async function scanLibrary() {
  const res = await apiFetch('/api/scan');
  if (!res.ok) throw new Error('Scan failed');
  return res.json();
}

export async function fetchFavorites() {
  const res = await apiFetch('/api/favorites');
  if (!res.ok) throw new Error('Failed to fetch favorites');
  return res.json();
}

export async function toggleFavorite(id) {
  const res = await apiFetch('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to toggle favorite');
  return res.json();
}

export async function fetchRecent() {
  const res = await apiFetch('/api/recent');
  if (!res.ok) throw new Error('Failed to fetch recent');
  return res.json();
}

export async function saveProgress(id, progress) {
  await apiFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ id, progress }),
  });
}

export async function getProgress(id) {
  const res = await apiFetch(`/api/progress/${id}`);
  if (!res.ok) return { progress: 0 };
  return res.json();
}

export function streamUrl(id) {
  const token = getToken();
  return `${API_BASE}/stream/${id}?token=${token}`;
}

export function imageUrl(id) {
  const token = getToken();
  return `${API_BASE}/images/${id}?token=${token}`;
}

export function subtitleUrl(id) {
  const token = getToken();
  return `${API_BASE}/subtitles/${id}?token=${token}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}
