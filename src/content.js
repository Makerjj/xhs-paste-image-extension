(function attachContentScript(global) {
  const api = global.XhsPasteImage;

  function isCreatorPage(locationRef = global.location) {
    return locationRef?.hostname === 'creator.xiaohongshu.com';
  }

  function isTopFrame() {
    try {
      return global.top === global;
    } catch {
      return false;
    }
  }

  function getImageFilesFromPasteEvent(event) {
    return getImageFilesFromTransfer(event?.clipboardData);
  }

  function getImageFilesFromDataTransfer(event) {
    return getImageFilesFromTransfer(event?.dataTransfer);
  }

  function hasDraggedFiles(event) {
    const transfer = event?.dataTransfer;
    if (!transfer) {
      return false;
    }

    const files = Array.from(transfer.files ?? []);
    if (files.length > 0) {
      return true;
    }

    const items = Array.from(transfer.items ?? []);
    if (items.some((item) => item?.kind === 'file')) {
      return true;
    }

    const types = Array.from(transfer.types ?? []);
    return types.some((type) => String(type).toLowerCase() === 'files');
  }

  function getImageFilesFromTransfer(transfer) {
    if (!transfer) {
      return [];
    }

    const files = Array.from(transfer.files ?? [])
      .filter((file) => file?.type?.startsWith('image/'));
    if (files.length) {
      return files;
    }

    return Array.from(transfer.items ?? [])
      .filter((item) => item?.kind === 'file' && item.type?.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function isSyntheticUploadEvent(event) {
    return Boolean(event?.__xhsPasteImageSyntheticUpload || global.__xhsPasteImageSyntheticDispatchDepth > 0);
  }

  function uploadImageFilesToPage(files, options = {}) {
    if (!files?.length) {
      throw new Error('剪贴板里没有图片');
    }

    const apiRef = options.api ?? api;
    const documentRef = options.documentRef ?? global.document;
    const input = apiRef.findImageFileInput(documentRef);
    if (apiRef.injectFilesIntoInput(input, files)) {
      return { method: 'input' };
    }

    throw new Error('找不到可用的上传入口');
  }

  async function pasteImageIntoPage() {
    const button = global.document.getElementById('xhs-paste-image-button');
    if (button) {
      button.disabled = true;
      button.textContent = '读取中...';
    }

    try {
      const file = await api.readFirstClipboardImageFile();
      const result = uploadImageFilesToPage([file]);
      if (result.method === 'input') {
        api.showToast(`已投递图片：${file.name}`);
        return true;
      }

      if (result.method === 'drop') {
        api.showToast(`已通过拖拽事件投递：${file.name}`);
        return true;
      }
    } catch (error) {
      api.showToast(error.message || '粘贴图片失败');
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '粘贴图片';
      }
    }
  }

  function handlePasteEvent(event) {
    const files = getImageFilesFromPasteEvent(event);
    if (!files.length) {
      api.showToast('已捕获粘贴，但剪贴板里没有浏览器可读取的图片文件');
      return false;
    }

    try {
      const result = uploadImageFilesToPage(files);
      event.preventDefault?.();
      event.stopPropagation?.();
      const methodText = result.method === 'drop' ? '拖拽事件' : '上传入口';
      api.showToast(`已通过${methodText}投递图片`);
      return true;
    } catch (error) {
      api.showToast(error.message || '粘贴图片失败');
      return false;
    }
  }

  function handleDragEnterEvent(event, options = {}) {
    if (isSyntheticUploadEvent(event)) {
      return false;
    }

    if (!hasDraggedFiles(event)) {
      return false;
    }

    event.preventDefault?.();
    const apiRef = options.api ?? api;
    const overlay = options.overlay ?? global.document.getElementById('xhs-paste-image-drop-overlay');
    apiRef.showDropOverlay?.(overlay);
    return true;
  }

  function handleDragOverEvent(event) {
    if (isSyntheticUploadEvent(event)) {
      return false;
    }

    if (!hasDraggedFiles(event)) {
      return false;
    }

    event.preventDefault?.();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    return true;
  }

  function handleDropEvent(event, options = {}) {
    if (isSyntheticUploadEvent(event)) {
      return false;
    }

    if (!hasDraggedFiles(event)) {
      return false;
    }

    event.preventDefault?.();
    event.stopPropagation?.();

    const files = getImageFilesFromDataTransfer(event);
    const apiRef = options.api ?? api;
    const documentRef = options.documentRef ?? global.document;
    const overlay = options.overlay ?? documentRef.getElementById?.('xhs-paste-image-drop-overlay');
    apiRef.hideDropOverlay?.(overlay);
    if (!files.length) {
      apiRef.showToast('拖入的文件里没有可上传的图片');
      return false;
    }

    try {
      uploadImageFilesToPage(files, { api: apiRef, documentRef });
      apiRef.showToast('已通过拖拽上传图片');
      return true;
    } catch (error) {
      apiRef.showToast(error.message || '拖拽上传失败');
      return false;
    }
  }

  function init() {
    if (global.XhsPasteImageInitialized) {
      return;
    }

    if (!isCreatorPage()) {
      return;
    }

    global.XhsPasteImageInitialized = true;
    const topFrame = isTopFrame();
    if (topFrame) {
      setupTopFrameUi();
    }

    global.document.addEventListener('paste', handlePasteEvent, true);
    global.addEventListener?.('paste', handlePasteEvent, true);
    if (!topFrame) {
      global.document.addEventListener('dragenter', handleDragEnterEvent, true);
    }
    global.addEventListener?.('dragenter', handleDragEnterEvent, true);
    global.document.addEventListener('dragover', handleDragOverEvent, true);
    global.document.addEventListener('drop', handleDropEvent, true);
    global.addEventListener?.('dragover', handleDragOverEvent, true);
    global.addEventListener?.('drop', handleDropEvent, true);
    global.document.documentElement?.addEventListener?.('dragenter', handleDragEnterEvent, true);
    global.document.documentElement?.addEventListener?.('dragover', handleDragOverEvent, true);
    global.document.documentElement?.addEventListener?.('drop', handleDropEvent, true);
    global.document.body?.addEventListener?.('dragenter', handleDragEnterEvent, true);
    global.document.body?.addEventListener?.('dragover', handleDragOverEvent, true);
    global.document.body?.addEventListener?.('drop', handleDropEvent, true);


    // Message routing is handled by the unified listener added below
  }

  function setupTopFrameUi() {
    const setup = () => {
      if (!global.document.body || global.XhsPasteImageUiInitialized) {
        return;
      }

      global.XhsPasteImageUiInitialized = true;
      api.createPasteButton(() => {
        void pasteImageIntoPage();
      });
      const overlay = api.createDropOverlay({
        onDragOver: handleDragOverEvent,
        onDragLeave: () => api.hideDropOverlay(overlay),
        onDrop: (event) => handleDropEvent(event, { overlay }),
      });
      global.document.addEventListener('dragenter', (event) => handleDragEnterEvent(event, { overlay }), true);
    };

    setup();
    if (!global.XhsPasteImageUiInitialized) {
      global.document.addEventListener('DOMContentLoaded', setup, { once: true });
    }
  }

  if (!global.__XHS_PASTE_IMAGE_TEST__) {
    if (global.document?.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', init, { once: true });
      init();
    } else {
      init();
    }

    // ---- Unified message listener (paste-image + localStorage I/O) ----
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        // Paste-image
        if (message.type === 'xhs-paste-image') {
          void pasteImageIntoPage().then((ok) => sendResponse({ ok }));
          return true;
        }

        // Get localStorage snapshot
        if (message.type === 'xhs-get-localstorage') {
          const ls = {};
          try {
            for (let i = 0; i < global.localStorage.length; i++) {
              const key = global.localStorage.key(i);
              ls[key] = global.localStorage.getItem(key);
            }
          } catch (_) { /* ignore */ }
          sendResponse(ls);
          return;
        }

        // Restore localStorage from snapshot
        if (message.type === 'xhs-restore-localstorage') {
          try {
            global.localStorage.clear();
            const data = message.data || {};
            for (const [key, value] of Object.entries(data)) {
              global.localStorage.setItem(key, value);
            }
            sendResponse({ restored: true });
          } catch (err) {
            sendResponse({ restored: false, error: err.message });
          }
          return;
        }
      });
    } catch (e) {
      // chrome.runtime might not be available in some contexts
    }
  }

  global.XhsPasteImage = Object.assign(global.XhsPasteImage ?? {}, {
    getImageFilesFromDataTransfer,
    getImageFilesFromPasteEvent,
    hasDraggedFiles,
    handleDragEnterEvent,
    handleDragOverEvent,
    handleDropEvent,
    handlePasteEvent,
    isCreatorPage,
    isTopFrame,
    pasteImageIntoPage,
    uploadImageFilesToPage,
  });
})(globalThis);
