(function attachUiModule(global) {
  const BUTTON_ID = 'xhs-paste-image-button';
  const TOAST_ID = 'xhs-paste-image-toast';
  const DROP_OVERLAY_ID = 'xhs-paste-image-drop-overlay';

  function ensureStyles(documentRef = document) {
    if (documentRef.getElementById('xhs-paste-image-styles')) {
      return;
    }

    const style = documentRef.createElement('style');
    style.id = 'xhs-paste-image-styles';
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        right: 24px;
        bottom: 96px;
        z-index: 2147483647;
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        background: #ff2442;
        color: #fff;
        font: 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,.18);
        cursor: pointer;
      }
      #${BUTTON_ID}:hover { background: #e61f3c; }
      #${BUTTON_ID}:disabled {
        opacity: .72;
        cursor: wait;
      }
      #${TOAST_ID} {
        position: fixed;
        right: 24px;
        bottom: 148px;
        z-index: 2147483647;
        max-width: 320px;
        border-radius: 8px;
        padding: 10px 12px;
        background: rgba(17, 24, 39, .94);
        color: #fff;
        font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 8px 24px rgba(0,0,0,.22);
      }
      #${DROP_OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(255, 36, 66, .10);
        border: 3px dashed rgba(255, 36, 66, .72);
        color: #ff2442;
        font: 18px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
      }
      #${DROP_OVERLAY_ID}.is-visible {
        display: flex;
      }
    `;
    documentRef.documentElement.appendChild(style);
  }

  function showToast(message, options = {}) {
    const documentRef = options.documentRef ?? document;
    ensureStyles(documentRef);

    let toast = documentRef.getElementById(TOAST_ID);
    if (!toast) {
      toast = documentRef.createElement('div');
      toast.id = TOAST_ID;
      documentRef.body.appendChild(toast);
    }

    toast.textContent = message;
    if (toast.xhsPasteImageTimerId) {
      global.clearTimeout(toast.xhsPasteImageTimerId);
    }
    const timerId = global.setTimeout(() => toast.remove(), options.timeout ?? 2800);
    toast.xhsPasteImageTimerId = timerId;
  }

  function createPasteButton(onClick, options = {}) {
    const documentRef = options.documentRef ?? document;
    ensureStyles(documentRef);

    const existing = documentRef.getElementById(BUTTON_ID);
    if (existing) {
      return existing;
    }

    const button = documentRef.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = '粘贴图片';
    button.title = '插件已加载。可按 Command+V/Ctrl+V，或点击此按钮从剪贴板粘贴图片到发布面板';
    button.addEventListener('click', onClick);
    documentRef.body.appendChild(button);
    return button;
  }

  function createDropOverlay(handlers = {}, options = {}) {
    const documentRef = options.documentRef ?? document;
    ensureStyles(documentRef);

    const existing = documentRef.getElementById(DROP_OVERLAY_ID);
    if (existing) {
      return existing;
    }

    const overlay = documentRef.createElement('div');
    overlay.id = DROP_OVERLAY_ID;
    overlay.textContent = '松开鼠标上传图片';
    overlay.addEventListener('dragover', handlers.onDragOver);
    overlay.addEventListener('dragleave', handlers.onDragLeave);
    overlay.addEventListener('drop', handlers.onDrop);
    documentRef.body.appendChild(overlay);
    return overlay;
  }

  function showDropOverlay(overlay) {
    overlay?.classList?.add('is-visible');
  }

  function hideDropOverlay(overlay) {
    overlay?.classList?.remove('is-visible');
  }

  const api = {
    createPasteButton,
    createDropOverlay,
    hideDropOverlay,
    showDropOverlay,
    showToast,
  };

  global.XhsPasteImage = Object.assign(global.XhsPasteImage ?? {}, api);
})(globalThis);
