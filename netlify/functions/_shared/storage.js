import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'server', 'data.json');

function emptyState() {
  return { favorites: [], searchHistory: [], alertRules: [], subscriptions: {}, notifications: [] };
}

let blobStorePromise = null;

function getBlobStore() {
  if (blobStorePromise) return blobStorePromise;
  blobStorePromise = (async () => {
    if (process.env.NETLIFY !== 'true') return null;
    try {
      const { getStore } = await import('@netlify/blobs');
      return getStore({ name: 'weatherpro-data' });
    } catch {
      return null;
    }
  })();
  return blobStorePromise;
}

export async function loadData() {
  const store = await getBlobStore();
  let data = null;
  if (store) {
    try {
      data = await store.get('state', { type: 'json' });
    } catch {
      data = null;
    }
  } else {
    try {
      if (fs.existsSync(DATA_FILE)) {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load data file:', e.message);
    }
  }
  return { ...emptyState(), ...(data || {}) };
}

export async function saveData(state) {
  const store = await getBlobStore();
  if (store) {
    try {
      await store.setJSON('state', state);
    } catch (e) {
      console.error('Failed to save to Netlify blob store:', e.message);
    }
    return;
  }
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data file:', e.message);
  }
}
