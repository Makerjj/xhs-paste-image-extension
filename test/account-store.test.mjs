import test from 'node:test';
import assert from 'node:assert/strict';

// Mock chrome.storage.local
const storageData = {};
globalThis.chrome = {
  storage: {
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
        } else if (typeof keys === 'string') {
          if (keys in storageData) result[keys] = storageData[keys];
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
  },
};

const { saveAccount, getAllAccounts, getAccount, deleteAccount, updateAccount, setActiveAccount, getActiveAccountId } = await import('../src/account-store.js');

test('getAllAccounts returns empty array when no accounts', async () => {
  const accounts = await getAllAccounts();
  assert.deepEqual(accounts, []);
});

test('saveAccount stores a new account', async () => {
  const account = await saveAccount('摄影号', [{ name: 'web_session', value: 'abc123' }], { token: 'x' });
  assert.equal(account.name, '摄影号');
  assert.equal(account.cookies.length, 1);
  assert.ok(account.id.startsWith('acc_'));
  const all = await getAllAccounts();
  assert.equal(all.length, 1);
});

test('saveAccount rejects duplicate web_session', async () => {
  await assert.rejects(
    () => saveAccount('dupe', [{ name: 'web_session', value: 'abc123' }], {}),
    /already saved/
  );
});

test('getAccount returns account by id', async () => {
  const accounts = await getAllAccounts();
  const found = await getAccount(accounts[0].id);
  assert.equal(found.name, '摄影号');
});

test('getAccount returns null for unknown id', async () => {
  const found = await getAccount('acc_nonexistent');
  assert.equal(found, null);
});

test('updateAccount updates name, cookies, localStorage', async () => {
  const accounts = await getAllAccounts();
  const id = accounts[0].id;
  await updateAccount(id, { name: '新名字', cookies: [{ name: 'ws', value: 'new' }], localStorage: { k: 'v' } });
  const updated = await getAccount(id);
  assert.equal(updated.name, '新名字');
  assert.equal(updated.cookies[0].value, 'new');
  assert.deepEqual(updated.localStorage, { k: 'v' });
});

test('deleteAccount removes account', async () => {
  const accounts = await getAllAccounts();
  const id = accounts[0].id;
  await deleteAccount(id);
  const all = await getAllAccounts();
  assert.equal(all.length, 0);
});

test('setActiveAccount and getActiveAccountId', async () => {
  await setActiveAccount('acc_test');
  const id = await getActiveAccountId();
  assert.equal(id, 'acc_test');
  await setActiveAccount(null);
  const none = await getActiveAccountId();
  assert.equal(none, null);
});

test('saveAccount with avatar', async () => {
  const account = await saveAccount('带头像', [{ name: 'web_session', value: 'xyz' }], {}, 'https://example.com/avatar.jpg');
  assert.equal(account.avatar, 'https://example.com/avatar.jpg');
  await deleteAccount(account.id);
});
