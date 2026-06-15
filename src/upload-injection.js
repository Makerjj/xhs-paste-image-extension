(function attachUploadInjectionModule(global) {
  function createDataTransfer(files, DataTransferCtor) {
    const transfer = new DataTransferCtor();
    for (const file of files) {
      transfer.items.add(file);
    }
    return transfer;
  }

  function injectFilesIntoInput(input, files, options = {}) {
    if (!input || !files?.length) {
      return false;
    }

    const DataTransferCtor = options.DataTransferCtor ?? global.DataTransfer;
    const EventCtor = options.EventCtor ?? global.Event;
    if (typeof DataTransferCtor !== 'function' || typeof EventCtor !== 'function') {
      return false;
    }

    try {
      const transfer = createDataTransfer(files, DataTransferCtor);
      input.files = transfer.files;
      input.dispatchEvent(new EventCtor('input', { bubbles: true }));
      input.dispatchEvent(new EventCtor('change', { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  function createDragEvent(type, transfer, DragEventCtor) {
    return new DragEventCtor(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
  }

  function dispatchFilesAsDrop(target, files, options = {}) {
    if (!target || !files?.length) {
      return false;
    }

    const DataTransferCtor = options.DataTransferCtor ?? global.DataTransfer;
    const DragEventCtor = options.DragEventCtor ?? global.DragEvent ?? global.Event;
    if (typeof DataTransferCtor !== 'function' || typeof DragEventCtor !== 'function') {
      return false;
    }

    try {
      const transfer = createDataTransfer(files, DataTransferCtor);
      for (const type of ['dragenter', 'dragover', 'drop']) {
        target.dispatchEvent(createDragEvent(type, transfer, DragEventCtor));
      }
      return true;
    } catch {
      return false;
    }
  }

  const api = {
    dispatchFilesAsDrop,
    injectFilesIntoInput,
  };

  global.XhsPasteImage = Object.assign(global.XhsPasteImage ?? {}, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(globalThis);
