# XHS Paste Image

Chrome extension for pasting clipboard images into the Xiaohongshu web creator publish panel.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `xhs-paste-image-extension` folder.

## Use

1. Open `https://creator.xiaohongshu.com/`.
2. Navigate to the publish page.
3. Copy an image into the system clipboard.
4. Press `Command+V` on macOS or `Ctrl+V` on Windows/Linux while the publish page is focused.
5. You can also drag image files directly onto the publish page.
6. Optional fallback: click the floating `粘贴图片` button.
7. Optional shortcut: press `Alt+Shift+V`. If Chrome blocks clipboard access from the shortcut path, use direct paste, drag-and-drop, or the floating button.

## How It Works

The extension listens for the page's real `paste`, `dragover`, and `drop` events. When pasted or dropped data contains image files, it sends those files to the publish panel. The floating button reads the clipboard after a user action and uses the same upload delivery methods.

1. Assign the file to the page's image file input and dispatch `input` and `change`.
2. Dispatch drag-and-drop events on a likely upload area.

## Limitations

- Direct `Command+V` / `Ctrl+V` depends on Chrome exposing image files through the page paste event.
- Drag-and-drop depends on Chrome exposing dragged files through the page drop event.
- Chrome requires a user gesture for explicit clipboard reads, so automatic background paste is not supported. The floating button is the explicit clipboard-read fallback.
- If Xiaohongshu changes the publish page DOM or rejects synthetic file events, the selector or event strategy may need adjustment.
- The extension does not use Xiaohongshu internal upload APIs.
- This only targets the web creator page, not the mobile app.

## Verification

Run:

```bash
node --test xhs-paste-image-extension/test/*.test.mjs
node --check xhs-paste-image-extension/src/content.js
node --check xhs-paste-image-extension/src/background.js
```

Then load the unpacked extension in Chrome and test with a real copied image on the publish page.
