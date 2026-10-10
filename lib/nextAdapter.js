// Runs a Node-style (req, res) handler from lib/handlers inside a Next.js route handler.
// The request is turned into a plain object with method, lowercased headers, query and body,
// and the response is collected and returned as a web Response.

async function runHandler(handler, request) {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Raw text: lib/http.js readBody parses it, so a bad body still gets the same 400.
    body = await request.text();
  }
  const req = {
    method: request.method,
    url: url.pathname + url.search,
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
  };

  const outHeaders = new Headers();
  const res = {
    statusCode: 200,
    body: '',
    setHeader(k, v) {
      outHeaders.set(k, String(v));
    },
    getHeader(k) {
      return outHeaders.get(k);
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.body += String(chunk);
      this.ended = true;
    },
  };

  await handler(req, res);
  return new Response(res.body, { status: res.statusCode, headers: outHeaders });
}

function routeFor(handler) {
  const run = (request) => runHandler(handler, request);
  return { GET: run, POST: run, PUT: run, PATCH: run, DELETE: run };
}

module.exports = { runHandler, routeFor };
