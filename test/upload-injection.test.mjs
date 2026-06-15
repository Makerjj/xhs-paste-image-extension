import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/upload-injection.js');

const {
  dispatchFilesAsDrop,
  injectFilesIntoInput,
} = globalThis.XhsPasteImage;

class TestDataTransfer {
  constructor() {
    this.items = {
      list: [],
      add: (file) => {
        this.items.list.push(file);
      },
    };
  }

  get files() {
    return this.items.list;
  }
}

class TestEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles;
    this.cancelable = options.cancelable;
    this.dataTransfer = options.dataTransfer;
  }
}

function createTarget() {
  return {
    events: [],
    dispatchEvent(event) {
      this.events.push(event);
      return true;
    },
  };
}

test('injectFilesIntoInput assigns files and dispatches input/change', () => {
  const input = createTarget();
  const file = { name: 'example.png', type: 'image/png' };

  const result = injectFilesIntoInput(input, [file], {
    DataTransferCtor: TestDataTransfer,
    EventCtor: TestEvent,
  });

  assert.equal(result, true);
  assert.deepEqual(input.files, [file]);
  assert.deepEqual(input.events.map((event) => event.type), ['input', 'change']);
});

test('dispatchFilesAsDrop dispatches dragenter/dragover/drop with files', () => {
  const target = createTarget();
  const file = { name: 'example.png', type: 'image/png' };

  const result = dispatchFilesAsDrop(target, [file], {
    DataTransferCtor: TestDataTransfer,
    DragEventCtor: TestEvent,
  });

  assert.equal(result, true);
  assert.deepEqual(target.events.map((event) => event.type), ['dragenter', 'dragover', 'drop']);
  assert.deepEqual(target.events[2].dataTransfer.files, [file]);
});

test('dispatchFilesAsDrop returns false without a target', () => {
  const result = dispatchFilesAsDrop(null, [{ name: 'example.png' }], {
    DataTransferCtor: TestDataTransfer,
    DragEventCtor: TestEvent,
  });

  assert.equal(result, false);
});
