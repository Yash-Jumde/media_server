const API_BASE = 'http://localhost:5000';

async function test() {
  try {
    // Login to get token
    const loginRes = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'qwerty_keys' })
    });
    
    if (!loginRes.ok) throw new Error('Login failed');
    const { token } = await loginRes.json();
    const headers = { Authorization: `Bearer ${token}` };

    // Get all media to pick one
    const mediaRes = await fetch(`${API_BASE}/api/media`, { headers });
    const mediaData = await mediaRes.json();
    const movies = mediaData.movies.files;
    
    if (movies.length === 0) {
      console.log('No movies found to test with.');
      return;
    }

    const testItem = movies[0];
    console.log(`Testing recommendations for: ${testItem.name} (${testItem.tmdb_genres})`);

    const recRes = await fetch(`${API_BASE}/api/recommendations/${testItem.id}`, { headers });
    const recs = await recRes.json();
    
    console.log(`Found ${recs.length} recommendations:`);
    recs.forEach((r, i) => {
      console.log(`${i+1}. ${r.title || r.name} - ${r.tmdb_genres}`);
    });

  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

test();
