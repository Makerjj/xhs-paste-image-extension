import { getAllAccounts, updateAccount, getAccount, setActiveAccount, getActiveAccountId } from './account-store.js';

const XHS_DOMAINS = [
  '.xiaohongshu.com',
  'www.xiaohongshu.com',
  'creator.xiaohongshu.com',
  '.xhscdn.com',
];

/**
 * Build a URL from cookie properties for chrome.cookies API calls.
 */
function cookieUrl(c) {
  const protocol = c.secure ? 'https://' : 'http://';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  return `${protocol}${host}${c.path || '/'}`;
}

/**
 * Capture all cookies for xiaohongshu domains.
 * chrome.cookies.getAll returns [] for domains with no cookies; errors are not expected.
 */
export async function captureCookies() {
  const all = [];
  for (const domain of XHS_DOMAINS) {
    const cookies = await chrome.cookies.getAll({ domain });
    all.push(...cookies);
  }
  // Deduplicate by name+domain
  const seen = new Set();
  return all.filter(c => {
    const key = `${c.name}@${c.domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Remove all xiaohongshu cookies.
 */
export async function clearAllCookies() {
  const cookies = await captureCookies();
  let failures = 0;
  for (const c of cookies) {
    try {
      await chrome.cookies.remove({ url: cookieUrl(c), name: c.name });
    } catch (_) {
      failures++;
      console.warn(`Failed to remove cookie ${c.name}`);
    }
  }
  if (failures > 0) {
    console.warn(`clearAllCookies: ${failures}/${cookies.length} removals failed`);
  }
}

/**
 * Restore cookies from a snapshot.
 */
export async function restoreCookies(cookies) {
  for (const c of cookies) {
    try {
      await chrome.cookies.set({
        url: cookieUrl(c),
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        secure: c.secure || false,
        httpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'lax',
        expirationDate: c.expirationDate,
      });
    } catch (err) {
      console.warn(`Failed to restore cookie ${c.name}:`, err);
    }
  }
}

/**
 * Rollback: restore backup cookies safely.
 * Never throws — failures are logged.
 */
async function safeRollback(backupCookies) {
  try {
    await clearAllCookies();
  } catch (_) {
    // ignore
  }
  try {
    await restoreCookies(backupCookies);
  } catch (_) {
    // ignore
  }
}

/**
 * Switch to a saved account.
 */
export async function switchToAccount(accountId, tabId) {
  // 1. Backup current cookies
  let backupCookies;
  try {
    backupCookies = await captureCookies();
  } catch (err) {
    return { success: false, error: 'Failed to capture current cookies' };
  }

  // 2. Get target account
  let targetAccount;
  try {
    targetAccount = await getAccount(accountId);
    if (!targetAccount) {
      return { success: false, error: 'Account not found' };
    }
  } catch (err) {
    return { success: false, error: 'Failed to load account' };
  }

  // 3. Save current snapshot back (update the previously active account)
  const activeId = await getActiveAccountId();
  if (activeId && activeId !== accountId) {
    try {
      await updateAccount(activeId, {
        cookies: backupCookies,
        lastUsedAt: Date.now(),
      });
    } catch (_) {
      // non-fatal
    }
  }

  // 4. Clear all cookies
  try {
    await clearAllCookies();
  } catch (err) {
    await restoreCookies(backupCookies);
    return { success: false, error: 'Failed to clear cookies' };
  }

  // 5. Restore target cookies
  try {
    await restoreCookies(targetAccount.cookies || []);
  } catch (err) {
    await safeRollback(backupCookies);
    return { success: false, error: 'Failed to restore target cookies' };
  }

  // 6. Update metadata
  await setActiveAccount(accountId);
  await updateAccount(accountId, { lastUsedAt: Date.now() });

  // 7. Restore localStorage via content script, then reload
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'xhs-restore-localstorage',
      data: targetAccount.localStorage || {},
    });
  } catch (_) {
    // content script might not be ready; localStorage is best-effort
  }

  await chrome.tabs.reload(tabId);
  return { success: true };
}

/**
 * Detect which saved account is currently active.
 */
export async function detectActiveAccount() {
  const accounts = await getAllAccounts();
  if (!accounts.length) return null;

  let currentSession = null;
  try {
    const cookies = await chrome.cookies.getAll({ name: 'web_session', domain: '.xiaohongshu.com' });
    if (cookies.length > 0) {
      currentSession = cookies[0].value;
    }
  } catch (_) {
    return null;
  }

  if (!currentSession) return null;

  for (const account of accounts) {
    const ws = (account.cookies || []).find(c => c.name === 'web_session');
    if (ws && ws.value === currentSession) {
      return account.id;
    }
  }
  return null;
}
