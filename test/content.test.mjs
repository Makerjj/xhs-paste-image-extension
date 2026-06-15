import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__XHS_PASTE_IMAGE_TEST__ = true;
await import('../src/paste-image.js');
await import('../src/dom-targets.js');
await import('../src/upload-injection.js');
await import('../src/ui.js');
await import('../src/content.js');

const {
  getImageFilesFromDataTransfer,
  getImageFilesFromPasteEvent,
  handleDragEnterEvent,
  handleDragOverEvent,
  handleDropEvent,
  hasDraggedFiles,
  uploadImageFilesToPage,
} = globalThis.XhsPasteImage;

test('getImageFilesFromPasteEvent extracts image files from clipboardData.files', () => {
  const imageFile = { name: 'clip.png', type: 'image/png' };
  const textFile = { name: 'note.txt', type: 'text/plain' };
  const event = {
    clipboardData: {
      files: [textFile, imageFile],
      items: [],
    },
  };

  assert.deepEqual(getImageFilesFromPasteEvent(event), [imageFile]);
});

test('getImageFilesFromPasteEvent extracts image files from clipboardData.items', () => {
  const imageFile = { name: 'clip.webp', type: 'image/webp' };
  const event = {
    clipboardData: {
      files: [],
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/webp', getAsFile: () => imageFile },
      ],
    },
  };

  assert.deepEqual(getImageFilesFromPasteEvent(event), [imageFile]);
});

test('getImageFilesFromDataTransfer extracts image files from dropped files', () => {
  const imageFile = { name: 'drag.png', type: 'image/png' };
  const textFile = { name: 'note.txt', type: 'text/plain' };
  const event = {
    dataTransfer: {
      files: [textFile, imageFile],
      items: [],
    },
  };

  assert.deepEqual(getImageFilesFromDataTransfer(event), [imageFile]);
});

test('getImageFilesFromDataTransfer extracts image files from dropped items', () => {
  const imageFile = { name: 'drag.webp', type: 'image/webp' };
  const event = {
    dataTransfer: {
      files: [],
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/webp', getAsFile: () => imageFile },
      ],
    },
  };

  assert.deepEqual(getImageFilesFromDataTransfer(event), [imageFile]);
});

test('uploadImageFilesToPage uses file input injection first', () => {
  const imageFile = { name: 'clip.png', type: 'image/png' };
  const input = {};
  const calls = [];
  const api = {
    findImageFileInput: () => input,
    injectFilesIntoInput(target, files) {
      calls.push(['input', target, files]);
      return true;
    },
    findDropZone: () => {
      throw new Error('drop zone should not be used');
    },
    dispatchFilesAsDrop: () => false,
  };

  const result = uploadImageFilesToPage([imageFile], { api, documentRef: {} });

  assert.equal(result.method, 'input');
  assert.deepEqual(calls, [['input', input, [imageFile]]]);
});

test('uploadImageFilesToPage falls back to drop events', () => {
  const imageFile = { name: 'clip.png', type: 'image/png' };
  const zone = {};
  const calls = [];
  const api = {
    findImageFileInput: () => null,
    injectFilesIntoInput: () => false,
    findDropZone: () => zone,
    dispatchFilesAsDrop(target, files) {
      calls.push(['drop', target, files]);
      return true;
    },
  };

  const result = uploadImageFilesToPage([imageFile], { api, documentRef: {} });

  assert.equal(result.method, 'drop');
  assert.deepEqual(calls, [['drop', zone, [imageFile]]]);
});

test('handleDragOverEvent prevents default when dragging image files', () => {
  const calls = [];
  const event = {
    dataTransfer: {
      files: [{ name: 'drag.png', type: 'image/png' }],
      items: [],
    },
    preventDefault: () => calls.push('preventDefault'),
  };

  assert.equal(handleDragOverEvent(event), true);
  assert.deepEqual(calls, ['preventDefault']);
});

test('handleDragEnterEvent shows drop overlay and prevents default for file drags', () => {
  const calls = [];
  const overlay = {};
  const event = {
    dataTransfer: {
      files: [],
      items: [{ kind: 'file', type: '' }],
      types: ['Files'],
    },
    preventDefault: () => calls.push('preventDefault'),
  };
  const api = {
    showDropOverlay: (target) => calls.push(['showDropOverlay', target]),
  };

  assert.equal(handleDragEnterEvent(event, { api, overlay }), true);
  assert.deepEqual(calls, [
    'preventDefault',
    ['showDropOverlay', overlay],
  ]);
});

test('hasDraggedFiles detects file drags before MIME type is available', () => {
  const event = {
    dataTransfer: {
      files: [],
      items: [
        { kind: 'file', type: '' },
      ],
      types: ['Files'],
    },
  };

  assert.equal(hasDraggedFiles(event), true);
});

test('handleDragOverEvent prevents default for file drags even before MIME type is available', () => {
  const calls = [];
  const event = {
    dataTransfer: {
      files: [],
      items: [
        { kind: 'file', type: '' },
      ],
      types: ['Files'],
    },
    preventDefault: () => calls.push('preventDefault'),
  };

  assert.equal(handleDragOverEvent(event), true);
  assert.deepEqual(calls, ['preventDefault']);
});

test('handleDropEvent blocks default navigation for non-image files', () => {
  const calls = [];
  const event = {
    dataTransfer: {
      files: [{ name: 'note.txt', type: 'text/plain' }],
      items: [],
      types: ['Files'],
    },
    preventDefault: () => calls.push('preventDefault'),
    stopPropagation: () => calls.push('stopPropagation'),
  };
  const api = {
    showToast: (message) => calls.push(['toast', message]),
  };

  assert.equal(handleDropEvent(event, { api, documentRef: {} }), false);
  assert.deepEqual(calls, [
    'preventDefault',
    'stopPropagation',
    ['toast', '拖入的文件里没有可上传的图片'],
  ]);
});

test('handleDropEvent uploads dropped image files', () => {
  const imageFile = { name: 'drag.png', type: 'image/png' };
  const calls = [];
  const event = {
    dataTransfer: {
      files: [imageFile],
      items: [],
    },
    preventDefault: () => calls.push('preventDefault'),
    stopPropagation: () => calls.push('stopPropagation'),
  };
  const api = {
    findImageFileInput: () => ({}),
    injectFilesIntoInput(target, files) {
      calls.push(['input', files]);
      return true;
    },
    findDropZone: () => null,
    dispatchFilesAsDrop: () => false,
    showToast: (message) => calls.push(['toast', message]),
  };

  assert.equal(handleDropEvent(event, { api, documentRef: {} }), true);
  assert.deepEqual(calls, [
    'preventDefault',
    'stopPropagation',
    ['input', [imageFile]],
    ['toast', '已通过拖拽上传图片'],
  ]);
});
