(function attachDomTargetsModule(global) {
  const DROP_ZONE_SELECTOR = [
    '[data-testid*="upload" i]',
    '[data-testid*="drop" i]',
    '[aria-label*="上传"]',
    '[aria-label*="upload" i]',
    '[class*="upload" i]',
    '[class*="Upload"]',
    '[class*="drop" i]',
    '[class*="uploader" i]',
    '[class*="creator"]',
  ].join(',');

  function isImageFileInput(input) {
    if (!input || input.disabled) {
      return false;
    }

    if (input.matches && !input.matches('input[type="file"]')) {
      return false;
    }

    const accept = (input.accept || input.getAttribute?.('accept') || '').trim().toLowerCase();
    if (!accept) {
      return true;
    }

    return accept.split(',').some((part) => {
      const token = part.trim();
      return token === 'image/*'
        || token.startsWith('image/')
        || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'].includes(token);
    });
  }

  function findImageFileInput(root = global.document) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return null;
    }

    const inputs = [...root.querySelectorAll('input[type="file"]')];
    return inputs.find(isImageFileInput) ?? null;
  }

  function hasUploadLanguage(element) {
    const text = [
      element.getAttribute?.('aria-label') ?? '',
      element.getAttribute?.('data-testid') ?? '',
      element.getAttribute?.('class') ?? '',
      element.textContent ?? '',
    ].join(' ');

    return /上传|upload|drop|拖拽|图片|image/i.test(text);
  }

  function findDropZone(root = global.document) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return null;
    }

    const selectorMatches = [...root.querySelectorAll(DROP_ZONE_SELECTOR)];
    const likelyZone = selectorMatches.find(hasUploadLanguage) ?? selectorMatches[0];
    if (likelyZone) {
      return likelyZone;
    }

    const allElements = [...root.querySelectorAll('button,div,section,label')];
    return allElements.find(hasUploadLanguage) ?? null;
  }

  const api = {
    findDropZone,
    findImageFileInput,
    isImageFileInput,
  };

  global.XhsPasteImage = Object.assign(global.XhsPasteImage ?? {}, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
