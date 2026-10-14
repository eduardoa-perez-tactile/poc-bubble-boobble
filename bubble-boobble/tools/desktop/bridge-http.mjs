// Node does not catch rejected promises returned by an HTTP request listener.
export function guardRequest(handle) {
  return (request, response) => {
    void Promise.resolve().then(() => handle(request, response)).catch(() => {
      // An interrupted body has already destroyed its response socket.
      if (request.aborted || response.destroyed || response.writableEnded) return;
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(500, {'content-type':'application/json'});
      response.end('{"error":"desktop request failed"}');
    });
  };
}
