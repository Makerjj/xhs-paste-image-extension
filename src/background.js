chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'paste-image') {
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !tab.url?.startsWith('https://creator.xiaohongshu.com/')) {
    return;
  }

  await chrome.tabs.sendMessage(tab.id, {
    type: 'xhs-paste-image',
  });
});
