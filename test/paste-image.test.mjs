import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/paste-image.js');

const {
  clipboardItemToImageFile,
  getFirstImageType,
} = globalThis.XhsPasteImage;

test('getFirstImageType returns the first image MIME type', () => {
  const item = {
    types: ['text/plain', 'image/webp', 'image/png'],
  };

  assert.equal(getFirstImageType(item), 'image/webp');
});

test('getFirstImageType returns null when the item has no image type', () => {
  const item = {
    types: ['text/html', 'text/plain'],
  };

  assert.equal(getFirstImageType(item), null);
});

test('clipboardItemToImageFile converts an image clipboard item to a File-like object', async () => {
  class TestFile extends Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified;
    }
  }

  const pngBlob = new Blob(['image-bytes'], { type: 'image/png' });
  const item = {
    types: ['text/plain', 'image/png'],
    async getType(type) {
      assert.equal(type, 'image/png');
      return pngBlob;
    },
  };

  const file = await clipboardItemToImageFile(item, {
    FileCtor: TestFile,
    now: () => 123,
  });

  assert.equal(file.name, 'xhs-pasted-image.png');
  assert.equal(file.type, 'image/png');
  assert.equal(file.lastModified, 123);
  assert.equal(await file.text(), 'image-bytes');
});

test('clipboardItemToImageFile rejects items without images', async () => {
  const item = {
    types: ['text/plain'],
    async getType() {
      throw new Error('should not be called');
    },
  };

  await assert.rejects(
    clipboardItemToImageFile(item),
    /剪贴板里没有图片/,
  );
});
