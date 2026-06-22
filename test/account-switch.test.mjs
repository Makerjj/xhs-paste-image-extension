import test from 'node:test';
import assert from 'node:assert/strict';

// Mock chrome.cookies and chrome.tabs (chrome.storage already mocked by account-store test pattern)
const cookieStore = [];

// Ensure chrome exists with minimal API
if (!globalThis.chrome) {
  globalThis.chrome = {};
}
if (!globalThis.chrome.storage) {
  const storageData = {};
  globalThis.chrome.storage = {
    local: {
      get(keys) {
        if (keys === null) return Promise.resolve({ ...storageData });
        const result = {};
        if (Array.isArray(keys)) {
          for (const k of keys) {
            if (k in storageData) result[k] = storageData[k];
          }
        } else if (typeof keys === 'object') {
          for (const [k, v] of Object.entries(keys)) {
            result[k] = k in storageData ? storageData[k] : v;
          }
        }
        return Promise.resolve(result);
      },
      set(items) {
        Object.assign(storageData, items);
        return Promise.resolve();
      },
      remove(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) delete storageData[k];
        return Promise.resolve();
      },
      clear() {
        for (const k of Object.keys(storageData)) delete storageData[k];
        return Promise.resolve();
      },
    },
  };
}

globalThis.chrome.cookies = {
  getAll({ domain }) {
    const matches = cookieStore.filter(c => {
      if (!domain) return true;
      return c.domain === domain || c.domain.endsWith(domain.replace(/^\./, ''));
    });
    return Promise.resolve(matches);
  },
  remove({ url, name }) {
    const idx = cookieStore.findIndex(c => c.name === name && url.includes(c.domain.replace(/^\./, '')));
    if (idx >= 0) cookieStore.splice(idx, 1);
    return Promise.resolve();
  },
  set(details) {
    cookieStore.push(details);
    return Promise.resolve(details);
  },
};

globalThis.chrome.tabs = {
  reload() { return Promise.resolve(); },
  sendMessage() { return Promise.resolve(); },
  query() { return Promise.resolve([{ id: 1, url: 'https://www.xiaohongshu.com/' }]); },
};

const {
  captureCookies,
  restoreCookies,
  clearAllCookies,
  switchToAccount,
  detectActiveAccount,
} = await import('../src/account-switch.js');

test('captureCookies returns cookies for xiaohongshu domains', async () => {
  cookieStore.length = 0;
  cookieStore.push(
    { name: 'web_session', value: 'sess1', domain: '.xiaohongshu.com' },
    { name: 'a1', value: 'a1val', domain: '.xiaohongshu.com' },
    { name: 'unrelated', value: 'x', domain: '.other.com' },
  );
  const cookies = await captureCookies();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some(c => c.name === 'web_session'));
  assert.ok(cookies.some(c => c.name === 'a1'));
  const unrelated = cookies.find(c => c.name === 'unrelated');
  assert.equal(unrelated, undefined);
});

test('clearAllCookies removes all xiaohongshu cookies', async () => {
  cookieStore.length = 0;
  cookieStore.push(
    { name: 'web_session', value: 'sess1', domain: '.xiaohongshu.com', path: '/' },
    { name: 'a1', value: 'a1val', domain: '.xiaohongshu.com', path: '/' },
  );
  await clearAllCookies();
  assert.equal(cookieStore.length, 0);
});

test('restoreCookies sets cookies from snapshot', async () => {
  cookieStore.length = 0;
  const snapshot = [
    { name: 'web_session', value: 'sess2', domain: '.xiaohongshu.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax' },
    { name: 'a1', value: 'a1new', domain: '.xiaohongshu.com', path: '/', secure: false, httpOnly: false },
  ];
  await restoreCookies(snapshot);
  assert.equal(cookieStore.length, 2);
  assert.ok(cookieStore[0].url.includes('xiaohongshu.com'));
});

test('restoreCookies with empty array does not throw', async () => {
  cookieStore.length = 0;
  await restoreCookies([]);
  assert.equal(cookieStore.length, 0);
});

test('captureCookies deduplicates by name+domain', async () => {
  cookieStore.length = 0;
  cookieStore.push(
    { name: 'a1', value: 'v1', domain: '.xiaohongshu.com' },
    { name: 'a1', value: 'v1', domain: '.xiaohongshu.com' },
  );
  const cookies = await captureCookies();
  assert.equal(cookies.length, 1);
});

// Seed account-store with test data for switchToAccount and detectActiveAccount tests
const storageDataInternal = {};
globalThis.chrome.storage.local._data = storageDataInternal;
globalThis.chrome.storage.local.get = function (keys) {
  if (keys === null) return Promise.resolve({ ...storageDataInternal });
  const result = {};
  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (k in storageDataInternal) result[k] = storageDataInternal[k];
    }
  } else if (typeof keys === 'object') {
    for (const [k, v] of Object.entries(keys)) {
      result[k] = k in storageDataInternal ? storageDataInternal[k] : v;
    }
  } else if (typeof keys === 'string') {
    if (keys in storageDataInternal) result[keys] = storageDataInternal[keys];
  }
  return Promise.resolve(result);
};
globalThis.chrome.storage.local.set = function (items) {
  Object.assign(storageDataInternal, items);
  return Promise.resolve();
};

async function seedAccount(id, name, sessionValue) {
  const account = {
    id,
    name,
    avatar: null,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    cookies: [{ name: 'web_session', value: sessionValue, domain: '.xiaohongshu.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax' }],
    localStorage: {},
  };
  const existing = storageDataInternal['xhs_accounts'] || [];
  existing.push(account);
  storageDataInternal['xhs_accounts'] = existing;
}

test('detectActiveAccount returns null when no accounts', async () => {
  storageDataInternal['xhs_accounts'] = [];
  storageDataInternal['xhs_active_account'] = null;
  cookieStore.length = 0;
  const result = await detectActiveAccount();
  assert.equal(result, null);
});

test('detectActiveAccount matches current web_session to saved account', async () => {
  storageDataInternal['xhs_accounts'] = [];
  storageDataInternal['xhs_active_account'] = null;
  cookieStore.length = 0;
  cookieStore.push({ name: 'web_session', value: 'match-me', domain: '.xiaohongshu.com' });
  await seedAccount('acc_a', '账号A', 'match-me');
  await seedAccount('acc_b', '账号B', 'other-val');

  const result = await detectActiveAccount();
  assert.equal(result, 'acc_a');
});

test('detectActiveAccount returns null when no session cookie present', async () => {
  storageDataInternal['xhs_accounts'] = [];
  storageDataInternal['xhs_active_account'] = null;
  cookieStore.length = 0;
  await seedAccount('acc_a', '账号A', 'match-me');

  const result = await detectActiveAccount();
  assert.equal(result, null);
});

test('switchToAccount full flow succeeds', async () => {
  storageDataInternal['xhs_accounts'] = [];
  storageDataInternal['xhs_active_account'] = 'acc_current';
  cookieStore.length = 0;
  cookieStore.push({ name: 'web_session', value: 'current-sess', domain: '.xiaohongshu.com', path: '/', secure: true });

  // Current account in storage
  await seedAccount('acc_current', '当前号', 'current-sess');
  // Target account
  await seedAccount('acc_target', '目标号', 'target-sess');

  const result = await switchToAccount('acc_target', 1);
  assert.equal(result.success, true);
  // Target cookies should now be in cookieStore
  assert.ok(cookieStore.some(c => c.value === 'target-sess'));
  // Active account should be updated
  assert.equal(storageDataInternal['xhs_active_account'], 'acc_target');
});

test('switchToAccount returns error for unknown account', async () => {
  storageDataInternal['xhs_accounts'] = [];
  storageDataInternal['xhs_active_account'] = null;
  cookieStore.length = 0;

  const result = await switchToAccount('acc_nonexistent', 1);
  assert.equal(result.success, false);
  assert.ok(result.error.includes('not found'));
});
