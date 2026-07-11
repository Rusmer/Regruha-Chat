export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  url.hostname = "r-chat.base44.app";

  const res = await fetch(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? null : await request.clone().text(),
    redirect: "manual",
  });

  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(`
          <style>
            #base44-badge,
            #base44-edit-badge {
              display: none !important;
            }
          </style>
        `, { html: true });
      },
    })
    .transform(res);
}
