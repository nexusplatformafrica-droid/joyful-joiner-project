# Native browser download manager for catalog movies

## Implementation
- Add a small same-origin download service worker that exposes a streamed MP4 response with attachment headers.
- Change catalog movie writing to send muxed MP4 chunks to that service worker and trigger a normal browser download immediately, matching Luo/Luganda behavior.
- Keep a blob fallback for browsers where service workers or transferable messaging are unavailable; remove the file-system Save As picker.
- Validate the download trigger and existing app rendering in Chromium.

## Technical details
- The browser continues rebuilding DASH video/audio client-side to avoid server request limits.
- Backpressure is coordinated one chunk at a time so the complete movie is not retained in page memory.
