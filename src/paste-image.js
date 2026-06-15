(function attachPasteImageModule(global) {
  const IMAGE_EXTENSION_BY_TYPE = new Map([
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png'],
    ['image/gif', 'gif'],
    ['image/webp', 'webp'],
    ['image/bmp', 'bmp'],
    ['image/heic', 'heic'],
    ['image/heif', 'heif'],
  ]);

  function getFirstImageType(item) {
    if (!item || !Array.isArray(item.types)) {
      return null;
    }

    return item.types.find((type) => typeof type === 'string' && type.startsWith('image/')) ?? null;
  }

  function extensionForType(type) {
    return IMAGE_EXTENSION_BY_TYPE.get(type) ?? 'png';
  }

  async function clipboardItemToImageFile(item, options = {}) {
    const imageType = getFirstImageType(item);
    if (!imageType) {
      throw new Error('剪贴板里没有图片');
    }

    const blob = await item.getType(imageType);
    const FileCtor = options.FileCtor ?? global.File;
    if (typeof FileCtor !== 'function') {
      throw new Error('当前浏览器不支持 File API');
    }

    const now = options.now ?? Date.now;
    const extension = extensionForType(imageType);
    return new FileCtor([blob], `xhs-pasted-image.${extension}`, {
      type: blob.type || imageType,
      lastModified: now(),
    });
  }

  async function readFirstClipboardImageFile(options = {}) {
    const clipboard = options.clipboard ?? global.navigator?.clipboard;
    if (!clipboard || typeof clipboard.read !== 'function') {
      throw new Error('当前页面无法读取剪贴板');
    }

    let items;
    try {
      items = await clipboard.read();
    } catch (error) {
      throw new Error(`读取剪贴板失败：${error.message}`);
    }

    const imageItem = items.find((item) => getFirstImageType(item));
    if (!imageItem) {
      throw new Error('剪贴板里没有图片');
    }

    return clipboardItemToImageFile(imageItem, options);
  }

  const api = {
    clipboardItemToImageFile,
    extensionForType,
    getFirstImageType,
    readFirstClipboardImageFile,
  };

  global.XhsPasteImage = Object.assign(global.XhsPasteImage ?? {}, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
