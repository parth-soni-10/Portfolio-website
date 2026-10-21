/* ---------------------------------------------------------------------------
 * Pages middleware: Markdown at the URL an agent already has.
 *
 * `/` and `/privacy` answer `text/markdown` when the request asks for it, and
 * HTML otherwise. The Markdown aliases (`/index.md`, `/privacy.md`) always
 * answer Markdown. An unmatched path still answers the branded 404.html for a
 * browser, and a Markdown 404 that says where to go for an agent.
 *
 * This is middleware rather than a Function per route because the 404 body has
 * to be negotiated on paths that do not exist, which no file-based route can
 * name. `_routes.json` keeps it off the static assets, so a stylesheet or an
 * image does not pay for a Function invocation.
 *
 * Response bodies live in `_agent-docs.js`, where the tests can reach them
 * without a Pages runtime. Nothing here rewrites a successful HTML response
 * beyond adding `Vary: Accept` (the response really does vary) and the
 * `rel="alternate"` link to its Markdown form.
 * ------------------------------------------------------------------------- */

import {
  DOCUMENTS,
  MARKDOWN_ALIASES,
  negotiate,
  markdownResponse,
  mergeVary,
  notFoundMarkdown,
  NOT_ACCEPTABLE_MARKDOWN,
} from "./_agent-docs.js";

function htmlAlternate(document) {
  return [
    `<${document.alternate}>; rel="alternate"; type="text/markdown"`,
    "</llms.txt>; rel=\"describedby\"; type=\"text/plain\"",
  ].join(", ");
}

function withDocumentHeaders(response, document) {
  const headers = new Headers(response.headers);
  mergeVary(headers);
  if (response.status >= 200 && response.status < 300) {
    headers.set("Link", htmlAlternate(document));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withVary(response) {
  const headers = new Headers(response.headers);
  mergeVary(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, next } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const pathname = new URL(request.url).pathname;

  const alias = MARKDOWN_ALIASES.get(pathname);
  if (alias) return markdownResponse(alias, 200, request.method);

  const document = DOCUMENTS.get(pathname);
  if (document) {
    const choice = negotiate(request.headers.get("Accept"));
    if (choice === "markdown") return markdownResponse(document.markdown, 200, request.method);
    if (choice === "not-acceptable") {
      return markdownResponse(NOT_ACCEPTABLE_MARKDOWN, 406, request.method);
    }
    return withDocumentHeaders(await next(), document);
  }

  const response = await next();
  if (response.status !== 404) return response;
  if (negotiate(request.headers.get("Accept")) === "markdown") {
    return markdownResponse(notFoundMarkdown(pathname), 404, request.method);
  }
  return withVary(response);
}
