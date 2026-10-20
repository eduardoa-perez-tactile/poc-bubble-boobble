/** Shared by local serving and browser acceptance so bootstrap assets load identically. */
export const webContentTypes = Object.freeze({
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
});
