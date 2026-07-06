export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, "https://lumenfi.pages.dev");

    const response = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow"
    });

    const headers = new Headers(response.headers);
    headers.set("x-lumenfi-origin", "cloudflare-pages");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
