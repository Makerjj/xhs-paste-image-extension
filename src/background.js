import { getAllAccounts, saveAccount, deleteAccount, getActiveAccountId, setActiveAccount } from './account-store.js';
import { captureCookies, switchToAccount, detectActiveAccount } from './account-switch.js';

// ---- Existing paste-image shortcut ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'paste-image') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://creator.xiaohongshu.com/')) return;
  await chrome.tabs.sendMessage(tab.id, { type: 'xhs-paste-image' });
});

// ---- Account switching messages ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error('handleMessage error:', err);
    sendResponse({ success: false, error: err.message || 'Internal error' });
  });
  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'getAccounts': {
      const accounts = await getAllAccounts();
      let activeId = await getActiveAccountId();
      if (!activeId && sender.tab?.url?.includes('xiaohongshu.com')) {
        activeId = await detectActiveAccount();
        if (activeId) await setActiveAccount(activeId);
      }
      return { accounts, activeAccountId: activeId };
    }

    case 'saveAccount': {
      const cookies = await captureCookies();
      if (!cookies.some(c => c.name === 'web_session')) {
        return { success: false, error: '未检测到登录状态。请先登录小红书。' };
      }
      let lsData = {};
      if (sender.tab?.id) {
        try {
          const resp = await chrome.tabs.sendMessage(sender.tab.id, { type: 'xhs-get-localstorage' });
          lsData = resp || {};
        } catch (_) { /* best-effort */ }
      }
      try {
        const account = await saveAccount(message.name || '未命名', cookies, lsData, message.avatar);
        return { success: true, account };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'switchAccount': {
      if (!sender.tab?.id) {
        return { success: false, error: 'No active tab' };
      }
      return await switchToAccount(message.accountId, sender.tab.id);
    }

    case 'deleteAccount': {
      try {
        await deleteAccount(message.accountId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}
