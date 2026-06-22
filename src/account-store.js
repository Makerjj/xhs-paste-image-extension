const STORAGE_KEY = 'xhs_accounts';
const ACTIVE_KEY = 'xhs_active_account';

export async function getAllAccounts() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

export async function getAccount(id) {
  const accounts = await getAllAccounts();
  return accounts.find(a => a.id === id) || null;
}

export async function saveAccount(name, cookies, localStorage, avatar = null) {
  const accounts = await getAllAccounts();
  const webSession = cookies.find(c => c.name === 'web_session');
  if (webSession) {
    const dup = accounts.find(a =>
      a.cookies.some(c => c.name === 'web_session' && c.value === webSession.value)
    );
    if (dup) throw new Error(`Account already saved as "${dup.name}"`);
  }
  const now = Date.now();
  const account = {
    id: `acc_${now}`,
    name,
    avatar,
    createdAt: now,
    lastUsedAt: now,
    cookies,
    localStorage: localStorage || {},
  };
  accounts.push(account);
  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
  return account;
}

export async function updateAccount(id, updates) {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === id);
  if (idx === -1) throw new Error(`Account ${id} not found`);
  Object.assign(accounts[idx], updates);
  await chrome.storage.local.set({ [STORAGE_KEY]: accounts });
}

export async function deleteAccount(id) {
  const accounts = await getAllAccounts();
  const filtered = accounts.filter(a => a.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  const activeId = await getActiveAccountId();
  if (activeId === id) {
    await setActiveAccount(null);
  }
}

export async function setActiveAccount(id) {
  await chrome.storage.local.set({ [ACTIVE_KEY]: id });
}

export async function getActiveAccountId() {
  const data = await chrome.storage.local.get(ACTIVE_KEY);
  return data[ACTIVE_KEY] || null;
}
