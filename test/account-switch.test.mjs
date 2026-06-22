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
