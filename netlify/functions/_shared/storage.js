import fs from 'fs';
import os from 'os';
import path from 'path';

const SERVERLESS = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) || Boolean(process.env.LAMBDA_TASK_ROOT);
const DATA_FILE = SERVERLESS
  ? path.join(os.tmpdir(), 'weatherpro-data.json')
  : path.join(process.cwd(), 'server', 'data.json');

function emptyState() {
  return {
    favorites: [],
    searchHistory: [],
    alertRules: [],
    subscriptions: {},
    notifications: [],
    pushSubscriptions: [],
    processedEvents: [],
    checkouts: [],
    users: [],
  };
}

let blobStorePromise = null;

function getBlobStore() {
  if (blobStorePromise) return blobStorePromise;
  blobStorePromise = (async () => {
    if (!SERVERLESS) return null;
    try {
      const { getStore } = await import('@netlify/blobs');
      return getStore({ name: 'weatherpro-data' });
    } catch (error) {
      console.error('Netlify Blobs unavailable:', error.message);
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
    await store.setJSON('state', state);
    return;
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
