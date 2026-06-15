import test from 'node:test';
import assert from 'node:assert/strict';

await import('../src/dom-targets.js');

const {
  findDropZone,
  findImageFileInput,
  isImageFileInput,
} = globalThis.XhsPasteImage;

function createElement(tagName, attributes = {}) {
  return {
    tagName: tagName.toUpperCase(),
    attributes,
    disabled: Boolean(attributes.disabled),
    type: attributes.type ?? '',
    accept: attributes.accept ?? '',
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    matches(selector) {
      if (selector === 'input[type="file"]') {
        return this.tagName === 'INPUT' && this.type === 'file';
      }
      return false;
    },
  };
}

function createDocument(elements) {
  return {
    querySelectorAll(selector) {
      if (selector === 'input[type="file"]') {
        return elements.filter((element) => element.matches(selector));
      }

      return elements.filter((element) => {
        const aria = element.getAttribute('aria-label') ?? '';
        const dataTestId = element.getAttribute('data-testid') ?? '';
        const className = element.getAttribute('class') ?? '';
        return [aria, dataTestId, className].some((value) => /upload|上传|drop/i.test(value));
      });
    },
  };
}

test('isImageFileInput accepts empty accept attribute because image uploaders often omit it', () => {
  const input = createElement('input', { type: 'file' });

  assert.equal(isImageFileInput(input), true);
});

test('isImageFileInput accepts image MIME filters', () => {
  const input = createElement('input', {
    type: 'file',
    accept: 'image/png,image/jpeg',
  });

  assert.equal(isImageFileInput(input), true);
});

test('isImageFileInput rejects non-image file filters', () => {
  const input = createElement('input', {
    type: 'file',
    accept: '.pdf,application/pdf',
  });

  assert.equal(isImageFileInput(input), false);
});

test('findImageFileInput returns the first enabled image input', () => {
  const pdfInput = createElement('input', {
    type: 'file',
    accept: 'application/pdf',
  });
  const imageInput = createElement('input', {
    type: 'file',
    accept: 'image/*',
  });
  const document = createDocument([pdfInput, imageInput]);

  assert.equal(findImageFileInput(document), imageInput);
});

test('findDropZone returns likely upload zones', () => {
  const element = createElement('div', {
    class: 'creator-upload-zone',
  });
  const document = createDocument([element]);

  assert.equal(findDropZone(document), element);
});
