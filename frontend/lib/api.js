const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:5000';
  
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

export const API_BASE = getApiBase();

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

  try {
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
  } catch (err) {
    console.error(`[API] apiFetch failed for ${endpoint}:`, err);
    throw err;
  }
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Invalid username or password');
  }

  const data = await res.json();
  setToken(data.token);
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  return data;
}

export async function register(username, password, avatarUrl) {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, avatar_url: avatarUrl }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Registration failed');
  }

  return res.json();
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export async function fetchProfile() {
  const res = await apiFetch('/api/user/profile');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error('[API] Fetch Profile Error:', errorData);
    throw new Error(errorData.error || 'Failed to fetch profile');
  }
  return res.json();
}

export async function updateProfile(data) {
  const res = await apiFetch('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to update profile');
  }
  const result = await res.json();
  if (typeof window !== 'undefined' && result.user) {
    const currentUser = getCurrentUser();
    localStorage.setItem('user', JSON.stringify({ ...currentUser, ...result.user }));
  }
  return result;
}

export async function fetchAllUsers() {
  const res = await apiFetch('/api/admin/users');
  if (!res.ok) throw new Error('Failed to fetch all users');
  return res.json();
}

export async function fetchPendingUsers() {
  const res = await apiFetch('/api/admin/pending');
  if (!res.ok) throw new Error('Failed to fetch pending users');
  return res.json();
}

export async function approveUser(id) {
  const res = await apiFetch('/api/admin/approve', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to approve user');
  return res.json();
}

export async function deleteUser(id) {
  const res = await apiFetch('/api/admin/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

export async function updateUserRole(id, role) {
  const res = await apiFetch('/api/admin/role', {
    method: 'POST',
    body: JSON.stringify({ id, role }),
  });
  if (!res.ok) throw new Error('Failed to update user role');
  return res.json();
}

export async function denyUser(id) {
  const res = await apiFetch('/api/admin/deny', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to deny user');
  return res.json();
}

export async function fetchMedia(category, page, limit) {
  if (!category) {
    const res = await apiFetch('/api/media');
    if (!res.ok) throw new Error('Failed to fetch categorized media');
    return res.json();
  }
  return exploreMedia({ category, page, limit });
}

export async function exploreMedia(params = {}) {
  let url = '/api/media/explore';
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });

  const queryString = queryParams.toString();
  if (queryString) {
    url += `?${queryString}`;
  }
  
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to explore media');
  return res.json();
}

export async function fetchMediaById(id) {
  const res = await apiFetch(`/api/media/${id}`);
  if (!res.ok) throw new Error('Failed to fetch media details');
  return res.json();
}

export async function fetchSeriesByName(name) {
  const res = await apiFetch(`/api/tv-shows/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Failed to fetch series details');
  return res.json();
}

export async function fetchNextEpisode(id) {
  const res = await apiFetch(`/api/media/${id}/next`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchRecommendations(id) {
  const res = await apiFetch(`/api/recommendations/${encodeURIComponent(id)}`);
  if (!res.ok) return [];
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

export async function fetchTranscodeQueue() {
  const res = await apiFetch('/api/transcode/queue');
  if (!res.ok) throw new Error('Failed to fetch transcode queue');
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

export function streamUrl(id, startTime = 0) {
  const token = getToken();
  let url = `${API_BASE}/stream/${id}?token=${token}`;
  if (startTime > 0) {
    url += `&startTime=${Math.floor(startTime)}`;
  }
  return url;
}

export function hlsUrl(id) {
  const token = getToken();
  return `${API_BASE}/hls/${id}/playlist.m3u8?token=${token}`;
}


export function imageUrl(id) {
  const token = getToken();
  return `${API_BASE}/images/${id}?token=${token}`;
}

export function subtitleUrl(id) {
  const token = getToken();
  return `${API_BASE}/subtitles/${id}?token=${token}`;
}

export function spriteUrl(id) {
  const token = getToken();
  return `${API_BASE}/transcoded/${id}_sprite.jpg?token=${token}`;
}

export function spriteMetaUrl(id) {
  const token = getToken();
  return `${API_BASE}/transcoded/${id}_sprite.json?token=${token}`;
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

export async function getStreamMode(id) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/stream-mode/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return { mode: 'live', isTranscoding: false, transcodePercent: null };
  return res.json();
}
