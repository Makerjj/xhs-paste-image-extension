const accountList = document.getElementById('accountList');
const saveBtn = document.getElementById('saveBtn');
const errorArea = document.getElementById('errorArea');
const tabStatus = document.getElementById('tabStatus');

let isOnXhs = false;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  isOnXhs = tab?.url?.includes('xiaohongshu.com');
  tabStatus.textContent = isOnXhs ? '' : '(非小红书页面)';
  if (!isOnXhs) {
    saveBtn.disabled = true;
    saveBtn.textContent = '请在 xiaohongshu.com 页面使用';
    saveBtn.style.opacity = '0.5';
  }
  await loadAccounts();
}

async function loadAccounts() {
  const resp = await chrome.runtime.sendMessage({ type: 'getAccounts' });
  const { accounts, activeAccountId } = resp;
  if (!accounts || accounts.length === 0) {
    accountList.innerHTML = `
      <div class="empty">
        <p>暂无已保存的账号</p>
        <p style="font-size:12px;">在小红书页面登录后<br>点击下方按钮保存此账号</p>
      </div>`;
    return;
  }
  accountList.innerHTML = accounts.map(a => {
    const isActive = a.id === activeAccountId;
    const isExpired = a.cookies && a.cookies.some(c => c.name === 'web_session' && c.expirationDate && c.expirationDate * 1000 < Date.now());
    let actionBtn = '';
    if (isActive) {
      actionBtn = '<span class="tag tag-active">当前</span>';
    } else if (isExpired) {
      actionBtn = '<span class="tag tag-expired">已过期</span>';
    } else {
      actionBtn = `<button class="btn btn-switch" data-switch="${a.id}" ${!isOnXhs ? 'disabled' : ''}>切换</button>`;
    }
    const avatarHtml = a.avatar
      ? `<div class="account-avatar"><img src="${escapeHtml(a.avatar)}" alt=""></div>`
      : `<div class="account-avatar"></div>`;
    const timeAgo = formatTimeAgo(a.lastUsedAt || a.createdAt);
    return `
      <div class="account-item">
        <div class="account-info">
          ${avatarHtml}
          <div class="account-detail">
            <div class="account-name">${escapeHtml(a.name)}</div>
            <div class="account-meta">${timeAgo}</div>
          </div>
        </div>
        ${actionBtn}
        <button class="delete-btn" data-delete="${a.id}" title="删除">&times;</button>
      </div>`;
  }).join('');

  accountList.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => handleSwitch(btn.dataset.switch));
  });
  accountList.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(btn.dataset.delete);
    });
  });
}

async function handleSwitch(accountId) {
  showError(null);
  saveBtn.disabled = true;
  const resp = await chrome.runtime.sendMessage({ type: 'switchAccount', accountId });
  if (!resp.success) {
    showError(resp.error || '切换失败');
    saveBtn.disabled = !isOnXhs;
  }
}

async function handleDelete(accountId) {
  if (!confirm('确定要删除此账号的快照数据吗？（不影响小红书账号本身）')) return;
  const resp = await chrome.runtime.sendMessage({ type: 'deleteAccount', accountId });
  if (resp.success) {
    await loadAccounts();
  } else {
    showError(resp.error || '删除失败');
  }
}

saveBtn.addEventListener('click', async () => {
  if (!isOnXhs) return;
  showError(null);
  const name = prompt('为这个账号起个名字：', '');
  if (!name) return;
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中...';
  const resp = await chrome.runtime.sendMessage({ type: 'saveAccount', name });
  if (resp.success) {
    await loadAccounts();
  } else {
    showError(resp.error || '保存失败');
  }
  saveBtn.disabled = !isOnXhs;
  saveBtn.textContent = '+ 保存当前账号';
});

function showError(msg) {
  if (msg) {
    errorArea.innerHTML = `<div class="error-toast">${escapeHtml(msg)}</div>`;
  } else {
    errorArea.innerHTML = '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 月前`;
}

init();
