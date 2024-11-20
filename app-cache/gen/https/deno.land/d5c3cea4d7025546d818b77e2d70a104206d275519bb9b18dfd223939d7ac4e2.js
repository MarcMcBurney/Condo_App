// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.
import { parse } from "../forwarded.ts";
import { isRouterContext } from "../util.ts";
function createMatcher({ match }) {
  return function matches(ctx) {
    if (!match) {
      return true;
    }
    if (typeof match === "string") {
      return ctx.request.url.pathname.startsWith(match);
    }
    if (match instanceof RegExp) {
      return match.test(ctx.request.url.pathname);
    }
    return match(ctx);
  };
}
async function createRequest(target, ctx, { headers: optHeaders, map, proxyHeaders = true, request: reqFn }) {
  let path = ctx.request.url.pathname;
  let params;
  if (isRouterContext(ctx)) {
    params = ctx.params;
  }
  if (map && typeof map === "function") {
    path = map(path, params);
  } else if (map) {
    path = map[path] ?? path;
  }
  const url = new URL(String(target));
  if (url.pathname.endsWith("/") && path.startsWith("/")) {
    url.pathname = `${url.pathname}${path.slice(1)}`;
  } else if (!url.pathname.endsWith("/") && !path.startsWith("/")) {
    url.pathname = `${url.pathname}/${path}`;
  } else {
    url.pathname = `${url.pathname}${path}`;
  }
  url.search = ctx.request.url.search;
  const body = getBodyInit(ctx);
  const headers = new Headers(ctx.request.headers);
  if (optHeaders) {
    if (typeof optHeaders === "function") {
      optHeaders = await optHeaders(ctx);
    }
    for (const [key, value] of iterableHeaders(optHeaders)){
      headers.set(key, value);
    }
  }
  if (proxyHeaders) {
    const maybeForwarded = headers.get("forwarded");
    const ip = ctx.request.ip.startsWith("[") ? `"${ctx.request.ip}"` : ctx.request.ip;
    const host = headers.get("host");
    if (maybeForwarded && parse(maybeForwarded)) {
      let value = `for=${ip}`;
      if (host) {
        value += `;host=${host}`;
      }
      headers.append("forwarded", value);
    } else {
      headers.append("x-forwarded-for", ip);
      if (host) {
        headers.append("x-forwarded-host", host);
      }
    }
  }
  const init = {
    body,
    headers,
    method: ctx.request.method,
    redirect: "follow"
  };
  let request = new Request(url.toString(), init);
  if (reqFn) {
    request = await reqFn(request);
  }
  return request;
}
function getBodyInit(ctx) {
  if (!ctx.request.hasBody) {
    return null;
  }
  return ctx.request.body({
    type: "stream"
  }).value;
}
function iterableHeaders(headers) {
  if (headers instanceof Headers) {
    return headers.entries();
  } else if (Array.isArray(headers)) {
    return headers.values();
  } else {
    return Object.entries(headers).values();
  }
}
async function processResponse(response, ctx, { contentType: contentTypeFn, response: resFn }) {
  if (resFn) {
    response = await resFn(response);
  }
  if (response.body) {
    ctx.response.body = response.body;
  } else {
    ctx.response.body = null;
  }
  ctx.response.status = response.status;
  for (const [key, value] of response.headers){
    ctx.response.headers.append(key, value);
  }
  if (contentTypeFn) {
    const value = await contentTypeFn(response.url, ctx.response.headers.get("content-type") ?? undefined);
    if (value != null) {
      ctx.response.headers.set("content-type", value);
    }
  }
}
export function proxy(target, options = {}) {
  const matches = createMatcher(options);
  return async function proxy(context, next) {
    if (!matches(context)) {
      return next();
    }
    const request = await createRequest(target, context, options);
    const { fetch = globalThis.fetch } = options;
    const response = await fetch(request, {
      context
    });
    await processResponse(response, context, options);
    return next();
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrQHYxMi42LjEvbWlkZGxld2FyZS9wcm94eS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIzIHRoZSBvYWsgYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmltcG9ydCB0eXBlIHsgU3RhdGUgfSBmcm9tIFwiLi4vYXBwbGljYXRpb24udHNcIjtcbmltcG9ydCB0eXBlIHsgQ29udGV4dCB9IGZyb20gXCIuLi9jb250ZXh0LnRzXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuLi9mb3J3YXJkZWQudHNcIjtcbmltcG9ydCB0eXBlIHsgTWlkZGxld2FyZSB9IGZyb20gXCIuLi9taWRkbGV3YXJlLnRzXCI7XG5pbXBvcnQgdHlwZSB7XG4gIFJvdXRlUGFyYW1zLFxuICBSb3V0ZXJDb250ZXh0LFxuICBSb3V0ZXJNaWRkbGV3YXJlLFxufSBmcm9tIFwiLi4vcm91dGVyLnRzXCI7XG5pbXBvcnQgeyBpc1JvdXRlckNvbnRleHQgfSBmcm9tIFwiLi4vdXRpbC50c1wiO1xuXG5leHBvcnQgdHlwZSBGZXRjaCA9IChcbiAgaW5wdXQ6IFJlcXVlc3QsXG4gIGluaXQ6IHsgY29udGV4dDogQ29udGV4dCB9LFxuKSA9PiBQcm9taXNlPFJlc3BvbnNlPjtcblxuZXhwb3J0IHR5cGUgUHJveHlNYXRjaEZ1bmN0aW9uPFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4gPSAoY3R4OiBDb250ZXh0PFM+IHwgUm91dGVyQ29udGV4dDxSLCBQLCBTPikgPT4gYm9vbGVhbjtcblxuZXhwb3J0IHR5cGUgUHJveHlNYXBGdW5jdGlvbjxSIGV4dGVuZHMgc3RyaW5nLCBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4+ID0gKFxuICBwYXRoOiBSLFxuICBwYXJhbXM/OiBQLFxuKSA9PiBSO1xuXG5leHBvcnQgdHlwZSBQcm94eUhlYWRlcnNGdW5jdGlvbjxTIGV4dGVuZHMgU3RhdGU+ID0gKFxuICBjdHg6IENvbnRleHQ8Uz4sXG4pID0+IEhlYWRlcnNJbml0IHwgUHJvbWlzZTxIZWFkZXJzSW5pdD47XG5cbmV4cG9ydCB0eXBlIFByb3h5Um91dGVySGVhZGVyc0Z1bmN0aW9uPFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4sXG4gIFMgZXh0ZW5kcyBTdGF0ZSxcbj4gPSAoY3R4OiBSb3V0ZXJDb250ZXh0PFIsIFAsIFM+KSA9PiBIZWFkZXJzSW5pdCB8IFByb21pc2U8SGVhZGVyc0luaXQ+O1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3h5T3B0aW9uczxcbiAgUiBleHRlbmRzIHN0cmluZyxcbiAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIFMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4sXG4+IHtcbiAgLyoqIEEgY2FsbGJhY2sgaG9vayB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgcmVzcG9uc2UgaXMgcmVjZWl2ZWQgd2hpY2ggYWxsb3dzXG4gICAqIHRoZSByZXNwb25zZSBjb250ZW50IHR5cGUgdG8gYmUgYWRqdXN0ZWQuIFRoaXMgaXMgZm9yIHNpdHVhdGlvbnMgd2hlcmUgdGhlXG4gICAqIGNvbnRlbnQgdHlwZSBwcm92aWRlZCBieSB0aGUgcHJveHkgc2VydmVyIG1pZ2h0IG5vdCBiZSBzdWl0YWJsZSBmb3JcbiAgICogcmVzcG9uZGluZyB3aXRoLiAqL1xuICBjb250ZW50VHlwZT8oXG4gICAgdXJsOiBzdHJpbmcsXG4gICAgY29udGVudFR5cGU/OiBzdHJpbmcsXG4gICk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB8IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgLyoqIFRoZSBmZXRjaCBmdW5jdGlvbiB0byB1c2UgdG8gcHJveHkgdGhlIHJlcXVlc3QuIFRoaXMgZGVmYXVsdHMgdG8gdGhlXG4gICAqIGdsb2JhbCB7QGxpbmtjb2RlIGZldGNofSBmdW5jdGlvbi4gSXQgd2lsbCBhbHdheXMgYmUgY2FsbGVkIHdpdGggYVxuICAgKiBzZWNvbmQgYXJndW1lbnQgd2hpY2ggY29udGFpbnMgYW4gb2JqZWN0IG9mIGB7IGNvbnRleHQgfWAgd2hpY2ggdGhlXG4gICAqIGBjb250ZXh0YCBwcm9wZXJ0eSB3aWxsIGJlIGFuIGluc3RhbmNlIG9mIHtAbGlua2NvZGUgUm91dGVyQ29udGV4dH0uXG4gICAqXG4gICAqIFRoaXMgaXMgZGVzaWduZWQgZm9yIG1vY2tpbmcgcHVycG9zZXMgb3IgaW1wbGVtZW50aW5nIGEgYGZldGNoKClgXG4gICAqIGNhbGxiYWNrIHRoYXQgbmVlZHMgYWNjZXNzIHRoZSBjdXJyZW50IGNvbnRleHQgd2hlbiBpdCBpcyBjYWxsZWQuICovXG4gIGZldGNoPzogRmV0Y2g7XG4gIC8qKiBBZGRpdGlvbmFsIGhlYWRlcnMgdGhhdCBzaG91bGQgYmUgc2V0IGluIHRoZSByZXNwb25zZS4gVGhlIHZhbHVlIGNhblxuICAgKiBiZSBhIGhlYWRlcnMgaW5pdCB2YWx1ZSBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBvciByZXNvbHZlcyB3aXRoIGFcbiAgICogaGVhZGVycyBpbml0IHZhbHVlLiAqL1xuICBoZWFkZXJzPzpcbiAgICB8IEhlYWRlcnNJbml0XG4gICAgfCBQcm94eUhlYWRlcnNGdW5jdGlvbjxTPlxuICAgIHwgUHJveHlSb3V0ZXJIZWFkZXJzRnVuY3Rpb248UiwgUCwgUz47XG4gIC8qKiBFaXRoZXIgYSByZWNvcmQgb3IgYSBwcm94eSBtYXAgZnVuY3Rpb24gdGhhdCB3aWxsIGFsbG93IHByb3hpZWQgcmVxdWVzdHNcbiAgICogYmVpbmcgaGFuZGxlZCBieSB0aGUgbWlkZGxld2FyZSB0byBiZSByZW1hcHBlZCB0byBhIGRpZmZlcmVudCByZW1vdGVcbiAgICogcGF0aC4gKi9cbiAgbWFwPzogUmVjb3JkPHN0cmluZywgUj4gfCBQcm94eU1hcEZ1bmN0aW9uPFIsIFA+O1xuICAvKiogQSBzdHJpbmcsIHJlZ3VsYXIgZXhwcmVzc2lvbiBvciBwcm94eSBtYXRjaCBmdW5jdGlvbiB3aGF0IGRldGVybWluZXMgaWZcbiAgICogdGhlIHByb3h5IG1pZGRsZXdhcmUgc2hvdWxkIHByb3h5IHRoZSByZXF1ZXN0LlxuICAgKlxuICAgKiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcgdGhlIG1hdGNoIHdpbGwgYmUgdHJ1ZSBpZiB0aGUgcmVxdWVzdHMgcGF0aG5hbWVcbiAgICogc3RhcnRzIHdpdGggdGhlIHN0cmluZy4gSW4gdGhlIGNhc2Ugb2YgYSByZWd1bGFyIGV4cHJlc3Npb24sIGlmIHRoZVxuICAgKiBwYXRobmFtZVxuICAgKi9cbiAgbWF0Y2g/OlxuICAgIHwgc3RyaW5nXG4gICAgfCBSZWdFeHBcbiAgICB8IFByb3h5TWF0Y2hGdW5jdGlvbjxSLCBQLCBTPjtcbiAgLyoqIEEgZmxhZyB0aGF0IGluZGljYXRlcyBpZiB0cmFkaXRpb25hbCBwcm94eSBoZWFkZXJzIHNob3VsZCBiZSBzZXQgaW4gdGhlXG4gICAqIHJlc3BvbnNlLiBUaGlzIGRlZmF1bHRzIHRvIGB0cnVlYC5cbiAgICovXG4gIHByb3h5SGVhZGVycz86IGJvb2xlYW47XG4gIC8qKiBBIGNhbGxiYWNrIGhvb2sgd2hpY2ggd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGVhY2ggcHJveGllZCBmZXRjaCByZXF1ZXN0XG4gICAqIHRvIGFsbG93IHRoZSBuYXRpdmUgYFJlcXVlc3RgIHRvIGJlIG1vZGlmaWVkIG9yIHJlcGxhY2VkLiAqL1xuICByZXF1ZXN0PyhyZXE6IFJlcXVlc3QpOiBSZXF1ZXN0IHwgUHJvbWlzZTxSZXF1ZXN0PjtcbiAgLyoqIEEgY2FsbGJhY2sgaG9vayB3aGljaCB3aWxsIGJlIGNhbGxlZCBhZnRlciBlYWNoIHByb3hpZWQgZmV0Y2ggcmVzcG9uc2VcbiAgICogaXMgcmVjZWl2ZWQgdG8gYWxsb3cgdGhlIG5hdGl2ZSBgUmVzcG9uc2VgIHRvIGJlIG1vZGlmaWVkIG9yIHJlcGxhY2VkLiAqL1xuICByZXNwb25zZT8ocmVzOiBSZXNwb25zZSk6IFJlc3BvbnNlIHwgUHJvbWlzZTxSZXNwb25zZT47XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU1hdGNoZXI8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPixcbiAgUyBleHRlbmRzIFN0YXRlLFxuPihcbiAgeyBtYXRjaCB9OiBQcm94eU9wdGlvbnM8UiwgUCwgUz4sXG4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIG1hdGNoZXMoY3R4OiBSb3V0ZXJDb250ZXh0PFIsIFAsIFM+KTogYm9vbGVhbiB7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbWF0Y2ggPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiBjdHgucmVxdWVzdC51cmwucGF0aG5hbWUuc3RhcnRzV2l0aChtYXRjaCk7XG4gICAgfVxuICAgIGlmIChtYXRjaCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIG1hdGNoLnRlc3QoY3R4LnJlcXVlc3QudXJsLnBhdGhuYW1lKTtcbiAgICB9XG4gICAgcmV0dXJuIG1hdGNoKGN0eCk7XG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVJlcXVlc3Q8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPixcbiAgUyBleHRlbmRzIFN0YXRlLFxuPihcbiAgdGFyZ2V0OiBzdHJpbmcgfCBVUkwsXG4gIGN0eDogQ29udGV4dDxTPiB8IFJvdXRlckNvbnRleHQ8UiwgUCwgUz4sXG4gIHsgaGVhZGVyczogb3B0SGVhZGVycywgbWFwLCBwcm94eUhlYWRlcnMgPSB0cnVlLCByZXF1ZXN0OiByZXFGbiB9OlxuICAgIFByb3h5T3B0aW9uczxSLCBQLCBTPixcbik6IFByb21pc2U8UmVxdWVzdD4ge1xuICBsZXQgcGF0aCA9IGN0eC5yZXF1ZXN0LnVybC5wYXRobmFtZSBhcyBSO1xuICBsZXQgcGFyYW1zOiBQIHwgdW5kZWZpbmVkO1xuICBpZiAoaXNSb3V0ZXJDb250ZXh0PFIsIFAsIFM+KGN0eCkpIHtcbiAgICBwYXJhbXMgPSBjdHgucGFyYW1zO1xuICB9XG4gIGlmIChtYXAgJiYgdHlwZW9mIG1hcCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcGF0aCA9IG1hcChwYXRoLCBwYXJhbXMpO1xuICB9IGVsc2UgaWYgKG1hcCkge1xuICAgIHBhdGggPSBtYXBbcGF0aF0gPz8gcGF0aDtcbiAgfVxuICBjb25zdCB1cmwgPSBuZXcgVVJMKFN0cmluZyh0YXJnZXQpKTtcbiAgaWYgKHVybC5wYXRobmFtZS5lbmRzV2l0aChcIi9cIikgJiYgcGF0aC5zdGFydHNXaXRoKFwiL1wiKSkge1xuICAgIHVybC5wYXRobmFtZSA9IGAke3VybC5wYXRobmFtZX0ke3BhdGguc2xpY2UoMSl9YDtcbiAgfSBlbHNlIGlmICghdXJsLnBhdGhuYW1lLmVuZHNXaXRoKFwiL1wiKSAmJiAhcGF0aC5zdGFydHNXaXRoKFwiL1wiKSkge1xuICAgIHVybC5wYXRobmFtZSA9IGAke3VybC5wYXRobmFtZX0vJHtwYXRofWA7XG4gIH0gZWxzZSB7XG4gICAgdXJsLnBhdGhuYW1lID0gYCR7dXJsLnBhdGhuYW1lfSR7cGF0aH1gO1xuICB9XG4gIHVybC5zZWFyY2ggPSBjdHgucmVxdWVzdC51cmwuc2VhcmNoO1xuXG4gIGNvbnN0IGJvZHkgPSBnZXRCb2R5SW5pdChjdHgpO1xuICBjb25zdCBoZWFkZXJzID0gbmV3IEhlYWRlcnMoY3R4LnJlcXVlc3QuaGVhZGVycyk7XG4gIGlmIChvcHRIZWFkZXJzKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRIZWFkZXJzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIG9wdEhlYWRlcnMgPSBhd2FpdCBvcHRIZWFkZXJzKGN0eCBhcyBSb3V0ZXJDb250ZXh0PFIsIFAsIFM+KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgaXRlcmFibGVIZWFkZXJzKG9wdEhlYWRlcnMpKSB7XG4gICAgICBoZWFkZXJzLnNldChrZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgaWYgKHByb3h5SGVhZGVycykge1xuICAgIGNvbnN0IG1heWJlRm9yd2FyZGVkID0gaGVhZGVycy5nZXQoXCJmb3J3YXJkZWRcIik7XG4gICAgY29uc3QgaXAgPSBjdHgucmVxdWVzdC5pcC5zdGFydHNXaXRoKFwiW1wiKVxuICAgICAgPyBgXCIke2N0eC5yZXF1ZXN0LmlwfVwiYFxuICAgICAgOiBjdHgucmVxdWVzdC5pcDtcbiAgICBjb25zdCBob3N0ID0gaGVhZGVycy5nZXQoXCJob3N0XCIpO1xuICAgIGlmIChtYXliZUZvcndhcmRlZCAmJiBwYXJzZShtYXliZUZvcndhcmRlZCkpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGBmb3I9JHtpcH1gO1xuICAgICAgaWYgKGhvc3QpIHtcbiAgICAgICAgdmFsdWUgKz0gYDtob3N0PSR7aG9zdH1gO1xuICAgICAgfVxuICAgICAgaGVhZGVycy5hcHBlbmQoXCJmb3J3YXJkZWRcIiwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXJzLmFwcGVuZChcIngtZm9yd2FyZGVkLWZvclwiLCBpcCk7XG4gICAgICBpZiAoaG9zdCkge1xuICAgICAgICBoZWFkZXJzLmFwcGVuZChcIngtZm9yd2FyZGVkLWhvc3RcIiwgaG9zdCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaW5pdDogUmVxdWVzdEluaXQgPSB7XG4gICAgYm9keSxcbiAgICBoZWFkZXJzLFxuICAgIG1ldGhvZDogY3R4LnJlcXVlc3QubWV0aG9kLFxuICAgIHJlZGlyZWN0OiBcImZvbGxvd1wiLFxuICB9O1xuICBsZXQgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KHVybC50b1N0cmluZygpLCBpbml0KTtcbiAgaWYgKHJlcUZuKSB7XG4gICAgcmVxdWVzdCA9IGF3YWl0IHJlcUZuKHJlcXVlc3QpO1xuICB9XG4gIHJldHVybiByZXF1ZXN0O1xufVxuXG5mdW5jdGlvbiBnZXRCb2R5SW5pdDxcbiAgUiBleHRlbmRzIHN0cmluZyxcbiAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+LFxuICBTIGV4dGVuZHMgU3RhdGUsXG4+KFxuICBjdHg6IENvbnRleHQ8Uz4gfCBSb3V0ZXJDb250ZXh0PFIsIFAsIFM+LFxuKTogQm9keUluaXQgfCBudWxsIHtcbiAgaWYgKCFjdHgucmVxdWVzdC5oYXNCb2R5KSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIGN0eC5yZXF1ZXN0LmJvZHkoeyB0eXBlOiBcInN0cmVhbVwiIH0pLnZhbHVlO1xufVxuXG5mdW5jdGlvbiBpdGVyYWJsZUhlYWRlcnMoXG4gIGhlYWRlcnM6IEhlYWRlcnNJbml0LFxuKTogSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBzdHJpbmddPiB7XG4gIGlmIChoZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycykge1xuICAgIHJldHVybiBoZWFkZXJzLmVudHJpZXMoKTtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGhlYWRlcnMpKSB7XG4gICAgcmV0dXJuIGhlYWRlcnMudmFsdWVzKCkgYXMgSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBzdHJpbmddPjtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMoaGVhZGVycykudmFsdWVzKCkgYXMgSXRlcmFibGVJdGVyYXRvcjxcbiAgICAgIFtzdHJpbmcsIHN0cmluZ11cbiAgICA+O1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NSZXNwb25zZTxcbiAgUiBleHRlbmRzIHN0cmluZyxcbiAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+LFxuICBTIGV4dGVuZHMgU3RhdGUsXG4+KFxuICByZXNwb25zZTogUmVzcG9uc2UsXG4gIGN0eDogQ29udGV4dDxTPiB8IFJvdXRlckNvbnRleHQ8UiwgUCwgUz4sXG4gIHsgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlRm4sIHJlc3BvbnNlOiByZXNGbiB9OiBQcm94eU9wdGlvbnM8UiwgUCwgUz4sXG4pIHtcbiAgaWYgKHJlc0ZuKSB7XG4gICAgcmVzcG9uc2UgPSBhd2FpdCByZXNGbihyZXNwb25zZSk7XG4gIH1cbiAgaWYgKHJlc3BvbnNlLmJvZHkpIHtcbiAgICBjdHgucmVzcG9uc2UuYm9keSA9IHJlc3BvbnNlLmJvZHk7XG4gIH0gZWxzZSB7XG4gICAgY3R4LnJlc3BvbnNlLmJvZHkgPSBudWxsO1xuICB9XG4gIGN0eC5yZXNwb25zZS5zdGF0dXMgPSByZXNwb25zZS5zdGF0dXM7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHJlc3BvbnNlLmhlYWRlcnMpIHtcbiAgICBjdHgucmVzcG9uc2UuaGVhZGVycy5hcHBlbmQoa2V5LCB2YWx1ZSk7XG4gIH1cbiAgaWYgKGNvbnRlbnRUeXBlRm4pIHtcbiAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGNvbnRlbnRUeXBlRm4oXG4gICAgICByZXNwb25zZS51cmwsXG4gICAgICBjdHgucmVzcG9uc2UuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgPz8gdW5kZWZpbmVkLFxuICAgICk7XG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgIGN0eC5yZXNwb25zZS5oZWFkZXJzLnNldChcImNvbnRlbnQtdHlwZVwiLCB2YWx1ZSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWlkZGxld2FyZSB0aGF0IHByb3ZpZGVzIGEgYmFjay10by1iYWNrIHByb3h5IGZvciByZXF1ZXN0cy5cbiAqXG4gKiBAcGFyYW0gdGFyZ2V0XG4gKiBAcGFyYW0gb3B0aW9uc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcHJveHk8UyBleHRlbmRzIFN0YXRlPihcbiAgdGFyZ2V0OiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnM/OiBQcm94eU9wdGlvbnM8c3RyaW5nLCBSb3V0ZVBhcmFtczxzdHJpbmc+LCBTPixcbik6IE1pZGRsZXdhcmU8Uz47XG5leHBvcnQgZnVuY3Rpb24gcHJveHk8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPixcbiAgUyBleHRlbmRzIFN0YXRlLFxuPihcbiAgdGFyZ2V0OiBzdHJpbmcgfCBVUkwsXG4gIG9wdGlvbnM6IFByb3h5T3B0aW9uczxSLCBQLCBTPiA9IHt9LFxuKTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPiB7XG4gIGNvbnN0IG1hdGNoZXMgPSBjcmVhdGVNYXRjaGVyKG9wdGlvbnMpO1xuICByZXR1cm4gYXN5bmMgZnVuY3Rpb24gcHJveHkoY29udGV4dCwgbmV4dCkge1xuICAgIGlmICghbWF0Y2hlcyhjb250ZXh0KSkge1xuICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdCA9IGF3YWl0IGNyZWF0ZVJlcXVlc3QodGFyZ2V0LCBjb250ZXh0LCBvcHRpb25zKTtcbiAgICBjb25zdCB7IGZldGNoID0gZ2xvYmFsVGhpcy5mZXRjaCB9ID0gb3B0aW9ucztcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHJlcXVlc3QsIHsgY29udGV4dCB9KTtcbiAgICBhd2FpdCBwcm9jZXNzUmVzcG9uc2UocmVzcG9uc2UsIGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIHJldHVybiBuZXh0KCk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEseUVBQXlFO0FBSXpFLFNBQVMsS0FBSyxRQUFRLGtCQUFrQjtBQU94QyxTQUFTLGVBQWUsUUFBUSxhQUFhO0FBcUY3QyxTQUFTLGNBS1AsRUFBRSxLQUFLLEVBQXlCO0VBRWhDLE9BQU8sU0FBUyxRQUFRLEdBQTJCO0lBQ2pELElBQUksQ0FBQyxPQUFPO01BQ1YsT0FBTztJQUNUO0lBQ0EsSUFBSSxPQUFPLFVBQVUsVUFBVTtNQUM3QixPQUFP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