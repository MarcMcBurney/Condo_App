/**
 * Adapted directly from @koa/router at
 * https://github.com/koajs/router/ which is licensed as:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Alexander C. Mingoia
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */ import { compile, errors, pathParse, pathToRegexp, Status } from "./deps.ts";
import { compose } from "./middleware.ts";
import { assert, decodeComponent } from "./util.ts";
/** Generate a URL from a string, potentially replace route params with
 * values. */ function toUrl(url, params = {}, options) {
  const tokens = pathParse(url);
  let replace = {};
  if (tokens.some((token)=>typeof token === "object")) {
    replace = params;
  } else {
    options = params;
  }
  const toPath = compile(url, options);
  const replaced = toPath(replace);
  if (options && options.query) {
    const url = new URL(replaced, "http://oak");
    if (typeof options.query === "string") {
      url.search = options.query;
    } else {
      url.search = String(options.query instanceof URLSearchParams ? options.query : new URLSearchParams(options.query));
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return replaced;
}
class Layer {
  #opts;
  #paramNames = [];
  #regexp;
  methods;
  name;
  path;
  stack;
  constructor(path, methods, middleware, { name, ...opts } = {}){
    this.#opts = opts;
    this.name = name;
    this.methods = [
      ...methods
    ];
    if (this.methods.includes("GET")) {
      this.methods.unshift("HEAD");
    }
    this.stack = Array.isArray(middleware) ? middleware.slice() : [
      middleware
    ];
    this.path = path;
    this.#regexp = pathToRegexp(path, this.#paramNames, this.#opts);
  }
  clone() {
    return new Layer(this.path, this.methods, this.stack, {
      name: this.name,
      ...this.#opts
    });
  }
  match(path) {
    return this.#regexp.test(path);
  }
  params(captures, existingParams = {}) {
    const params = existingParams;
    for(let i = 0; i < captures.length; i++){
      if (this.#paramNames[i]) {
        const c = captures[i];
        params[this.#paramNames[i].name] = c ? decodeComponent(c) : c;
      }
    }
    return params;
  }
  captures(path) {
    if (this.#opts.ignoreCaptures) {
      return [];
    }
    return path.match(this.#regexp)?.slice(1) ?? [];
  }
  url(params = {}, options) {
    const url = this.path.replace(/\(\.\*\)/g, "");
    return toUrl(url, params, options);
  }
  param(param, // deno-lint-ignore no-explicit-any
  fn) {
    const stack = this.stack;
    const params = this.#paramNames;
    const middleware = function(ctx, next) {
      const p = ctx.params[param];
      assert(p);
      return fn.call(this, p, ctx, next);
    };
    middleware.param = param;
    const names = params.map((p)=>p.name);
    const x = names.indexOf(param);
    if (x >= 0) {
      for(let i = 0; i < stack.length; i++){
        const fn = stack[i];
        if (!fn.param || names.indexOf(fn.param) > x) {
          stack.splice(i, 0, middleware);
          break;
        }
      }
    }
    return this;
  }
  setPrefix(prefix) {
    if (this.path) {
      this.path = this.path !== "/" || this.#opts.strict === true ? `${prefix}${this.path}` : prefix;
      this.#paramNames = [];
      this.#regexp = pathToRegexp(this.path, this.#paramNames, this.#opts);
    }
    return this;
  }
  // deno-lint-ignore no-explicit-any
  toJSON() {
    return {
      methods: [
        ...this.methods
      ],
      middleware: [
        ...this.stack
      ],
      paramNames: this.#paramNames.map((key)=>key.name),
      path: this.path,
      regexp: this.#regexp,
      options: {
        ...this.#opts
      }
    };
  }
  [Symbol.for("Deno.customInspect")](inspect) {
    return `${this.constructor.name} ${inspect({
      methods: this.methods,
      middleware: this.stack,
      options: this.#opts,
      paramNames: this.#paramNames.map((key)=>key.name),
      path: this.path,
      regexp: this.#regexp
    })}`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](depth, // deno-lint-ignore no-explicit-any
  options, inspect) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }
    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1
    });
    return `${options.stylize(this.constructor.name, "special")} ${inspect({
      methods: this.methods,
      middleware: this.stack,
      options: this.#opts,
      paramNames: this.#paramNames.map((key)=>key.name),
      path: this.path,
      regexp: this.#regexp
    }, newOptions)}`;
  }
}
/** An interface for registering middleware that will run when certain HTTP
 * methods and paths are requested, as well as provides a way to parameterize
 * parts of the requested path.
 *
 * ### Basic example
 *
 * ```ts
 * import { Application, Router } from "https://deno.land/x/oak/mod.ts";
 *
 * const router = new Router();
 * router.get("/", (ctx, next) => {
 *   // handle the GET endpoint here
 * });
 * router.all("/item/:item", (ctx, next) => {
 *   // called for all HTTP verbs/requests
 *   ctx.params.item; // contains the value of `:item` from the parsed URL
 * });
 *
 * const app = new Application();
 * app.use(router.routes());
 * app.use(router.allowedMethods());
 *
 * app.listen({ port: 8080 });
 * ```
 */ export class Router {
  #opts;
  #methods;
  // deno-lint-ignore no-explicit-any
  #params = {};
  #stack = [];
  #match(path, method) {
    const matches = {
      path: [],
      pathAndMethod: [],
      route: false
    };
    for (const route of this.#stack){
      if (route.match(path)) {
        matches.path.push(route);
        if (route.methods.length === 0 || route.methods.includes(method)) {
          matches.pathAndMethod.push(route);
          if (route.methods.length) {
            matches.route = true;
            matches.name = route.name;
          }
        }
      }
    }
    return matches;
  }
  #register(path, middlewares, methods, options = {}) {
    if (Array.isArray(path)) {
      for (const p of path){
        this.#register(p, middlewares, methods, options);
      }
      return;
    }
    let layerMiddlewares = [];
    for (const middleware of middlewares){
      if (!middleware.router) {
        layerMiddlewares.push(middleware);
        continue;
      }
      if (layerMiddlewares.length) {
        this.#addLayer(path, layerMiddlewares, methods, options);
        layerMiddlewares = [];
      }
      const router = middleware.router.#clone();
      for (const layer of router.#stack){
        if (!options.ignorePrefix) {
          layer.setPrefix(path);
        }
        if (this.#opts.prefix) {
          layer.setPrefix(this.#opts.prefix);
        }
        this.#stack.push(layer);
      }
      for (const [param, mw] of Object.entries(this.#params)){
        router.param(param, mw);
      }
    }
    if (layerMiddlewares.length) {
      this.#addLayer(path, layerMiddlewares, methods, options);
    }
  }
  #addLayer(path, middlewares, methods, options = {}) {
    const { end, name, sensitive = this.#opts.sensitive, strict = this.#opts.strict, ignoreCaptures } = options;
    const route = new Layer(path, methods, middlewares, {
      end,
      name,
      sensitive,
      strict,
      ignoreCaptures
    });
    if (this.#opts.prefix) {
      route.setPrefix(this.#opts.prefix);
    }
    for (const [param, mw] of Object.entries(this.#params)){
      route.param(param, mw);
    }
    this.#stack.push(route);
  }
  #route(name) {
    for (const route of this.#stack){
      if (route.name === name) {
        return route;
      }
    }
  }
  #useVerb(nameOrPath, pathOrMiddleware, middleware, methods) {
    let name = undefined;
    let path;
    if (typeof pathOrMiddleware === "string") {
      name = nameOrPath;
      path = pathOrMiddleware;
    } else {
      path = nameOrPath;
      middleware.unshift(pathOrMiddleware);
    }
    this.#register(path, middleware, methods, {
      name
    });
  }
  #clone() {
    const router = new Router(this.#opts);
    router.#methods = router.#methods.slice();
    router.#params = {
      ...this.#params
    };
    router.#stack = this.#stack.map((layer)=>layer.clone());
    return router;
  }
  constructor(opts = {}){
    this.#opts = opts;
    this.#methods = opts.methods ?? [
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT"
    ];
  }
  add(methods, nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, typeof methods === "string" ? [
      methods
    ] : methods);
    return this;
  }
  all(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, this.#methods.filter((method)=>method !== "OPTIONS"));
    return this;
  }
  /** Middleware that handles requests for HTTP methods registered with the
   * router.  If none of the routes handle a method, then "not allowed" logic
   * will be used.  If a method is supported by some routes, but not the
   * particular matched router, then "not implemented" will be returned.
   *
   * The middleware will also automatically handle the `OPTIONS` method,
   * responding with a `200 OK` when the `Allowed` header sent to the allowed
   * methods for a given route.
   *
   * By default, a "not allowed" request will respond with a `405 Not Allowed`
   * and a "not implemented" will respond with a `501 Not Implemented`. Setting
   * the option `.throw` to `true` will cause the middleware to throw an
   * `HTTPError` instead of setting the response status.  The error can be
   * overridden by providing a `.notImplemented` or `.notAllowed` method in the
   * options, of which the value will be returned will be thrown instead of the
   * HTTP error. */ allowedMethods(options = {}) {
    const implemented = this.#methods;
    const allowedMethods = async (context, next)=>{
      const ctx = context;
      await next();
      if (!ctx.response.status || ctx.response.status === Status.NotFound) {
        assert(ctx.matched);
        const allowed = new Set();
        for (const route of ctx.matched){
          for (const method of route.methods){
            allowed.add(method);
          }
        }
        const allowedStr = [
          ...allowed
        ].join(", ");
        if (!implemented.includes(ctx.request.method)) {
          if (options.throw) {
            throw options.notImplemented ? options.notImplemented() : new errors.NotImplemented();
          } else {
            ctx.response.status = Status.NotImplemented;
            ctx.response.headers.set("Allow", allowedStr);
          }
        } else if (allowed.size) {
          if (ctx.request.method === "OPTIONS") {
            ctx.response.status = Status.OK;
            ctx.response.headers.set("Allow", allowedStr);
          } else if (!allowed.has(ctx.request.method)) {
            if (options.throw) {
              throw options.methodNotAllowed ? options.methodNotAllowed() : new errors.MethodNotAllowed();
            } else {
              ctx.response.status = Status.MethodNotAllowed;
              ctx.response.headers.set("Allow", allowedStr);
            }
          }
        }
      }
    };
    return allowedMethods;
  }
  delete(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "DELETE"
    ]);
    return this;
  }
  /** Iterate over the routes currently added to the router.  To be compatible
   * with the iterable interfaces, both the key and value are set to the value
   * of the route. */ *entries() {
    for (const route of this.#stack){
      const value = route.toJSON();
      yield [
        value,
        value
      ];
    }
  }
  /** Iterate over the routes currently added to the router, calling the
   * `callback` function for each value. */ forEach(callback, // deno-lint-ignore no-explicit-any
  thisArg = null) {
    for (const route of this.#stack){
      const value = route.toJSON();
      callback.call(thisArg, value, value, this);
    }
  }
  get(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "GET"
    ]);
    return this;
  }
  head(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "HEAD"
    ]);
    return this;
  }
  /** Iterate over the routes currently added to the router.  To be compatible
   * with the iterable interfaces, the key is set to the value of the route. */ *keys() {
    for (const route of this.#stack){
      yield route.toJSON();
    }
  }
  options(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "OPTIONS"
    ]);
    return this;
  }
  /** Register param middleware, which will be called when the particular param
   * is parsed from the route. */ param(param, middleware) {
    this.#params[param] = middleware;
    for (const route of this.#stack){
      route.param(param, middleware);
    }
    return this;
  }
  patch(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "PATCH"
    ]);
    return this;
  }
  post(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "POST"
    ]);
    return this;
  }
  /** Set the router prefix for this router. */ prefix(prefix) {
    prefix = prefix.replace(/\/$/, "");
    this.#opts.prefix = prefix;
    for (const route of this.#stack){
      route.setPrefix(prefix);
    }
    return this;
  }
  put(nameOrPath, pathOrMiddleware, ...middleware) {
    this.#useVerb(nameOrPath, pathOrMiddleware, middleware, [
      "PUT"
    ]);
    return this;
  }
  /** Register a direction middleware, where when the `source` path is matched
   * the router will redirect the request to the `destination` path.  A `status`
   * of `302 Found` will be set by default.
   *
   * The `source` and `destination` can be named routes. */ redirect(source, destination, status = Status.Found) {
    if (source[0] !== "/") {
      const s = this.url(source);
      if (!s) {
        throw new RangeError(`Could not resolve named route: "${source}"`);
      }
      source = s;
    }
    if (typeof destination === "string") {
      if (destination[0] !== "/") {
        const d = this.url(destination);
        if (!d) {
          try {
            const url = new URL(destination);
            destination = url;
          } catch  {
            throw new RangeError(`Could not resolve named route: "${source}"`);
          }
        } else {
          destination = d;
        }
      }
    }
    this.all(source, async (ctx, next)=>{
      await next();
      ctx.response.redirect(destination);
      ctx.response.status = status;
    });
    return this;
  }
  /** Return middleware that will do all the route processing that the router
   * has been configured to handle.  Typical usage would be something like this:
   *
   * ```ts
   * import { Application, Router } from "https://deno.land/x/oak/mod.ts";
   *
   * const app = new Application();
   * const router = new Router();
   *
   * // register routes
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods());
   * await app.listen({ port: 80 });
   * ```
   */ routes() {
    const dispatch = (context, next)=>{
      const ctx = context;
      let pathname;
      let method;
      try {
        const { url: { pathname: p }, method: m } = ctx.request;
        pathname = p;
        method = m;
      } catch (e) {
        return Promise.reject(e);
      }
      const path = this.#opts.routerPath ?? ctx.routerPath ?? decodeURI(pathname);
      const matches = this.#match(path, method);
      if (ctx.matched) {
        ctx.matched.push(...matches.path);
      } else {
        ctx.matched = [
          ...matches.path
        ];
      }
      // deno-lint-ignore no-explicit-any
      ctx.router = this;
      if (!matches.route) return next();
      ctx.routeName = matches.name;
      const { pathAndMethod: matchedRoutes } = matches;
      const chain = matchedRoutes.reduce((prev, route)=>[
          ...prev,
          (ctx, next)=>{
            ctx.captures = route.captures(path);
            ctx.params = route.params(ctx.captures, ctx.params);
            return next();
          },
          ...route.stack
        ], []);
      return compose(chain)(ctx, next);
    };
    dispatch.router = this;
    return dispatch;
  }
  /** Generate a URL pathname for a named route, interpolating the optional
   * params provided.  Also accepts an optional set of options. */ url(name, params, options) {
    const route = this.#route(name);
    if (route) {
      return route.url(params, options);
    }
  }
  use(pathOrMiddleware, ...middleware) {
    let path;
    if (typeof pathOrMiddleware === "string" || Array.isArray(pathOrMiddleware)) {
      path = pathOrMiddleware;
    } else {
      middleware.unshift(pathOrMiddleware);
    }
    this.#register(path ?? "(.*)", middleware, [], {
      end: false,
      ignoreCaptures: !path,
      ignorePrefix: !path
    });
    return this;
  }
  /** Iterate over the routes currently added to the router. */ *values() {
    for (const route of this.#stack){
      yield route.toJSON();
    }
  }
  /** Provide an iterator interface that iterates over the routes registered
   * with the router. */ *[Symbol.iterator]() {
    for (const route of this.#stack){
      yield route.toJSON();
    }
  }
  /** Generate a URL pathname based on the provided path, interpolating the
   * optional params provided.  Also accepts an optional set of options. */ static url(path, params, options) {
    return toUrl(path, params, options);
  }
  [Symbol.for("Deno.customInspect")](inspect) {
    return `${this.constructor.name} ${inspect({
      "#params": this.#params,
      "#stack": this.#stack
    })}`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](depth, // deno-lint-ignore no-explicit-any
  options, inspect) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }
    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1
    });
    return `${options.stylize(this.constructor.name, "special")} ${inspect({
      "#params": this.#params,
      "#stack": this.#stack
    }, newOptions)}`;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrQHYxMi42LjEvcm91dGVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWRhcHRlZCBkaXJlY3RseSBmcm9tIEBrb2Evcm91dGVyIGF0XG4gKiBodHRwczovL2dpdGh1Yi5jb20va29hanMvcm91dGVyLyB3aGljaCBpcyBsaWNlbnNlZCBhczpcbiAqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUgQWxleGFuZGVyIEMuIE1pbmdvaWFcbiAqXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICpcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICovXG5cbmltcG9ydCB0eXBlIHsgU3RhdGUgfSBmcm9tIFwiLi9hcHBsaWNhdGlvbi50c1wiO1xuaW1wb3J0IHR5cGUgeyBDb250ZXh0IH0gZnJvbSBcIi4vY29udGV4dC50c1wiO1xuaW1wb3J0IHtcbiAgY29tcGlsZSxcbiAgZXJyb3JzLFxuICB0eXBlIEhUVFBNZXRob2RzLFxuICBLZXksXG4gIFBhcnNlT3B0aW9ucyxcbiAgcGF0aFBhcnNlLFxuICBwYXRoVG9SZWdleHAsXG4gIHR5cGUgUmVkaXJlY3RTdGF0dXMsXG4gIFN0YXR1cyxcbiAgVG9rZW5zVG9SZWdleHBPcHRpb25zLFxufSBmcm9tIFwiLi9kZXBzLnRzXCI7XG5pbXBvcnQgeyBjb21wb3NlLCBNaWRkbGV3YXJlIH0gZnJvbSBcIi4vbWlkZGxld2FyZS50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0LCBkZWNvZGVDb21wb25lbnQgfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbmludGVyZmFjZSBNYXRjaGVzPFIgZXh0ZW5kcyBzdHJpbmc+IHtcbiAgcGF0aDogTGF5ZXI8Uj5bXTtcbiAgcGF0aEFuZE1ldGhvZDogTGF5ZXI8Uj5bXTtcbiAgcm91dGU6IGJvb2xlYW47XG4gIG5hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUm91dGVyQWxsb3dlZE1ldGhvZHNPcHRpb25zIHtcbiAgLyoqIFVzZSB0aGUgdmFsdWUgcmV0dXJuZWQgZnJvbSB0aGlzIGZ1bmN0aW9uIGluc3RlYWQgb2YgYW4gSFRUUCBlcnJvclxuICAgKiBgTWV0aG9kTm90QWxsb3dlZGAuICovXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG1ldGhvZE5vdEFsbG93ZWQ/KCk6IGFueTtcblxuICAvKiogVXNlIHRoZSB2YWx1ZSByZXR1cm5lZCBmcm9tIHRoaXMgZnVuY3Rpb24gaW5zdGVhZCBvZiBhbiBIVFRQIGVycm9yXG4gICAqIGBOb3RJbXBsZW1lbnRlZGAuICovXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG5vdEltcGxlbWVudGVkPygpOiBhbnk7XG5cbiAgLyoqIFdoZW4gZGVhbGluZyB3aXRoIGEgbm9uLWltcGxlbWVudGVkIG1ldGhvZCBvciBhIG1ldGhvZCBub3QgYWxsb3dlZCwgdGhyb3dcbiAgICogYW4gZXJyb3IgaW5zdGVhZCBvZiBzZXR0aW5nIHRoZSBzdGF0dXMgYW5kIGhlYWRlciBmb3IgdGhlIHJlc3BvbnNlLiAqL1xuICB0aHJvdz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUm91dGU8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuPiB7XG4gIC8qKiBUaGUgSFRUUCBtZXRob2RzIHRoYXQgdGhpcyByb3V0ZSBoYW5kbGVzLiAqL1xuICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdO1xuXG4gIC8qKiBUaGUgbWlkZGxld2FyZSB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGlzIHJvdXRlLiAqL1xuICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W107XG5cbiAgLyoqIEFuIG9wdGlvbmFsIG5hbWUgZm9yIHRoZSByb3V0ZS4gKi9cbiAgbmFtZT86IHN0cmluZztcblxuICAvKiogT3B0aW9ucyB0aGF0IHdlcmUgdXNlZCB0byBjcmVhdGUgdGhlIHJvdXRlLiAqL1xuICBvcHRpb25zOiBMYXllck9wdGlvbnM7XG5cbiAgLyoqIFRoZSBwYXJhbWV0ZXJzIHRoYXQgYXJlIGlkZW50aWZpZWQgaW4gdGhlIHJvdXRlIHRoYXQgd2lsbCBiZSBwYXJzZWQgb3V0XG4gICAqIG9uIG1hdGNoZWQgcmVxdWVzdHMuICovXG4gIHBhcmFtTmFtZXM6IChrZXlvZiBQKVtdO1xuXG4gIC8qKiBUaGUgcGF0aCB0aGF0IHRoaXMgcm91dGUgbWFuYWdlcy4gKi9cbiAgcGF0aDogc3RyaW5nO1xuXG4gIC8qKiBUaGUgcmVndWxhciBleHByZXNzaW9uIHVzZWQgZm9yIG1hdGNoaW5nIGFuZCBwYXJzaW5nIHBhcmFtZXRlcnMgZm9yIHRoZVxuICAgKiByb3V0ZS4gKi9cbiAgcmVnZXhwOiBSZWdFeHA7XG59XG5cbi8qKiBUaGUgY29udGV4dCBwYXNzZWQgcm91dGVyIG1pZGRsZXdhcmUuICAqL1xuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXJDb250ZXh0PFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4gZXh0ZW5kcyBDb250ZXh0PFM+IHtcbiAgLyoqIFdoZW4gbWF0Y2hpbmcgdGhlIHJvdXRlLCBhbiBhcnJheSBvZiB0aGUgY2FwdHVyaW5nIGdyb3VwcyBmcm9tIHRoZSByZWd1bGFyXG4gICAqIGV4cHJlc3Npb24uICovXG4gIGNhcHR1cmVzOiBzdHJpbmdbXTtcblxuICAvKiogVGhlIHJvdXRlcyB0aGF0IHdlcmUgbWF0Y2hlZCBmb3IgdGhpcyByZXF1ZXN0LiAqL1xuICBtYXRjaGVkPzogTGF5ZXI8UiwgUCwgUz5bXTtcblxuICAvKiogQW55IHBhcmFtZXRlcnMgcGFyc2VkIGZyb20gdGhlIHJvdXRlIHdoZW4gbWF0Y2hlZC4gKi9cbiAgcGFyYW1zOiBQO1xuXG4gIC8qKiBBIHJlZmVyZW5jZSB0byB0aGUgcm91dGVyIGluc3RhbmNlLiAqL1xuICByb3V0ZXI6IFJvdXRlcjtcblxuICAvKiogSWYgdGhlIG1hdGNoZWQgcm91dGUgaGFzIGEgYG5hbWVgLCB0aGUgbWF0Y2hlZCByb3V0ZSBuYW1lIGlzIHByb3ZpZGVkXG4gICAqIGhlcmUuICovXG4gIHJvdXRlTmFtZT86IHN0cmluZztcblxuICAvKiogT3ZlcnJpZGVzIHRoZSBtYXRjaGVkIHBhdGggZm9yIGZ1dHVyZSByb3V0ZSBtaWRkbGV3YXJlLCB3aGVuIGFcbiAgICogYHJvdXRlclBhdGhgIG9wdGlvbiBpcyBub3QgZGVmaW5lZCBvbiB0aGUgYFJvdXRlcmAgb3B0aW9ucy4gKi9cbiAgcm91dGVyUGF0aD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXJNaWRkbGV3YXJlPFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4ge1xuICAoY29udGV4dDogUm91dGVyQ29udGV4dDxSLCBQLCBTPiwgbmV4dDogKCkgPT4gUHJvbWlzZTx1bmtub3duPik6XG4gICAgfCBQcm9taXNlPHVua25vd24+XG4gICAgfCB1bmtub3duO1xuICAvKiogRm9yIHJvdXRlIHBhcmFtZXRlciBtaWRkbGV3YXJlLCB0aGUgYHBhcmFtYCBrZXkgZm9yIHRoaXMgcGFyYW1ldGVyIHdpbGxcbiAgICogYmUgc2V0LiAqL1xuICBwYXJhbT86IGtleW9mIFA7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHJvdXRlcj86IFJvdXRlcjxhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlck9wdGlvbnMge1xuICAvKiogT3ZlcnJpZGUgdGhlIGRlZmF1bHQgc2V0IG9mIG1ldGhvZHMgc3VwcG9ydGVkIGJ5IHRoZSByb3V0ZXIuICovXG4gIG1ldGhvZHM/OiBIVFRQTWV0aG9kc1tdO1xuXG4gIC8qKiBPbmx5IGhhbmRsZSByb3V0ZXMgd2hlcmUgdGhlIHJlcXVlc3RlZCBwYXRoIHN0YXJ0cyB3aXRoIHRoZSBwcmVmaXguICovXG4gIHByZWZpeD86IHN0cmluZztcblxuICAvKiogT3ZlcnJpZGUgdGhlIGByZXF1ZXN0LnVybC5wYXRobmFtZWAgd2hlbiBtYXRjaGluZyBtaWRkbGV3YXJlIHRvIHJ1bi4gKi9cbiAgcm91dGVyUGF0aD86IHN0cmluZztcblxuICAvKiogRGV0ZXJtaW5lcyBpZiByb3V0ZXMgYXJlIG1hdGNoZWQgaW4gYSBjYXNlIHNlbnNpdGl2ZSB3YXkuICBEZWZhdWx0cyB0b1xuICAgKiBgZmFsc2VgLiAqL1xuICBzZW5zaXRpdmU/OiBib29sZWFuO1xuXG4gIC8qKiBEZXRlcm1pbmVzIGlmIHJvdXRlcyBhcmUgbWF0Y2hlZCBzdHJpY3RseSwgd2hlcmUgdGhlIHRyYWlsaW5nIGAvYCBpcyBub3RcbiAgICogb3B0aW9uYWwuICBEZWZhdWx0cyB0byBgZmFsc2VgLiAqL1xuICBzdHJpY3Q/OiBib29sZWFuO1xufVxuXG4vKiogTWlkZGxld2FyZSB0aGF0IHdpbGwgYmUgY2FsbGVkIGJ5IHRoZSByb3V0ZXIgd2hlbiBoYW5kbGluZyBhIHNwZWNpZmljXG4gKiBwYXJhbWV0ZXIsIHdoaWNoIHRoZSBtaWRkbGV3YXJlIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSByZXF1ZXN0IG1hdGNoZXMgdGhlXG4gKiByb3V0ZSBwYXJhbWV0ZXIuICovXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlclBhcmFtTWlkZGxld2FyZTxcbiAgUiBleHRlbmRzIHN0cmluZyxcbiAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIFMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4sXG4+IHtcbiAgKFxuICAgIHBhcmFtOiBzdHJpbmcsXG4gICAgY29udGV4dDogUm91dGVyQ29udGV4dDxSLCBQLCBTPixcbiAgICBuZXh0OiAoKSA9PiBQcm9taXNlPHVua25vd24+LFxuICApOiBQcm9taXNlPHVua25vd24+IHwgdW5rbm93bjtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcm91dGVyPzogUm91dGVyPGFueT47XG59XG5cbmludGVyZmFjZSBQYXJhbXNEaWN0aW9uYXJ5IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xufVxuXG50eXBlIFJlbW92ZVRhaWw8UyBleHRlbmRzIHN0cmluZywgVGFpbCBleHRlbmRzIHN0cmluZz4gPSBTIGV4dGVuZHNcbiAgYCR7aW5mZXIgUH0ke1RhaWx9YCA/IFAgOiBTO1xuXG50eXBlIEdldFJvdXRlUGFyYW1zPFMgZXh0ZW5kcyBzdHJpbmc+ID0gUmVtb3ZlVGFpbDxcbiAgUmVtb3ZlVGFpbDxSZW1vdmVUYWlsPFMsIGAvJHtzdHJpbmd9YD4sIGAtJHtzdHJpbmd9YD4sXG4gIGAuJHtzdHJpbmd9YFxuPjtcblxuZXhwb3J0IHR5cGUgUm91dGVQYXJhbXM8Um91dGUgZXh0ZW5kcyBzdHJpbmc+ID0gc3RyaW5nIGV4dGVuZHMgUm91dGVcbiAgPyBQYXJhbXNEaWN0aW9uYXJ5XG4gIDogUm91dGUgZXh0ZW5kcyBgJHtzdHJpbmd9KCR7c3RyaW5nfWAgPyBQYXJhbXNEaWN0aW9uYXJ5XG4gIDogUm91dGUgZXh0ZW5kcyBgJHtzdHJpbmd9OiR7aW5mZXIgUmVzdH1gID9cbiAgICAgICYgKFxuICAgICAgICBHZXRSb3V0ZVBhcmFtczxSZXN0PiBleHRlbmRzIG5ldmVyID8gUGFyYW1zRGljdGlvbmFyeVxuICAgICAgICAgIDogR2V0Um91dGVQYXJhbXM8UmVzdD4gZXh0ZW5kcyBgJHtpbmZlciBQYXJhbU5hbWV9P2BcbiAgICAgICAgICAgID8geyBbUCBpbiBQYXJhbU5hbWVdPzogc3RyaW5nIH1cbiAgICAgICAgICA6IHsgW1AgaW4gR2V0Um91dGVQYXJhbXM8UmVzdD5dOiBzdHJpbmcgfVxuICAgICAgKVxuICAgICAgJiAoUmVzdCBleHRlbmRzIGAke0dldFJvdXRlUGFyYW1zPFJlc3Q+fSR7aW5mZXIgTmV4dH1gID8gUm91dGVQYXJhbXM8TmV4dD5cbiAgICAgICAgOiB1bmtub3duKVxuICA6IFJlY29yZDxzdHJpbmcgfCBudW1iZXIsIHN0cmluZyB8IHVuZGVmaW5lZD47XG5cbnR5cGUgTGF5ZXJPcHRpb25zID0gVG9rZW5zVG9SZWdleHBPcHRpb25zICYgUGFyc2VPcHRpb25zICYge1xuICBpZ25vcmVDYXB0dXJlcz86IGJvb2xlYW47XG4gIG5hbWU/OiBzdHJpbmc7XG59O1xuXG50eXBlIFJlZ2lzdGVyT3B0aW9ucyA9IExheWVyT3B0aW9ucyAmIHtcbiAgaWdub3JlUHJlZml4PzogYm9vbGVhbjtcbn07XG5cbnR5cGUgVXJsT3B0aW9ucyA9IFRva2Vuc1RvUmVnZXhwT3B0aW9ucyAmIFBhcnNlT3B0aW9ucyAmIHtcbiAgLyoqIFdoZW4gZ2VuZXJhdGluZyBhIFVSTCBmcm9tIGEgcm91dGUsIGFkZCB0aGUgcXVlcnkgdG8gdGhlIFVSTC4gIElmIGFuXG4gICAqIG9iamVjdCAqL1xuICBxdWVyeT86IFVSTFNlYXJjaFBhcmFtcyB8IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBzdHJpbmc7XG59O1xuXG4vKiogR2VuZXJhdGUgYSBVUkwgZnJvbSBhIHN0cmluZywgcG90ZW50aWFsbHkgcmVwbGFjZSByb3V0ZSBwYXJhbXMgd2l0aFxuICogdmFsdWVzLiAqL1xuZnVuY3Rpb24gdG9Vcmw8UiBleHRlbmRzIHN0cmluZz4oXG4gIHVybDogc3RyaW5nLFxuICBwYXJhbXMgPSB7fSBhcyBSb3V0ZVBhcmFtczxSPixcbiAgb3B0aW9ucz86IFVybE9wdGlvbnMsXG4pIHtcbiAgY29uc3QgdG9rZW5zID0gcGF0aFBhcnNlKHVybCk7XG4gIGxldCByZXBsYWNlID0ge30gYXMgUm91dGVQYXJhbXM8Uj47XG5cbiAgaWYgKHRva2Vucy5zb21lKCh0b2tlbikgPT4gdHlwZW9mIHRva2VuID09PSBcIm9iamVjdFwiKSkge1xuICAgIHJlcGxhY2UgPSBwYXJhbXM7XG4gIH0gZWxzZSB7XG4gICAgb3B0aW9ucyA9IHBhcmFtcztcbiAgfVxuXG4gIGNvbnN0IHRvUGF0aCA9IGNvbXBpbGUodXJsLCBvcHRpb25zKTtcbiAgY29uc3QgcmVwbGFjZWQgPSB0b1BhdGgocmVwbGFjZSk7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5xdWVyeSkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVwbGFjZWQsIFwiaHR0cDovL29ha1wiKTtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMucXVlcnkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHVybC5zZWFyY2ggPSBvcHRpb25zLnF1ZXJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICB1cmwuc2VhcmNoID0gU3RyaW5nKFxuICAgICAgICBvcHRpb25zLnF1ZXJ5IGluc3RhbmNlb2YgVVJMU2VhcmNoUGFyYW1zXG4gICAgICAgICAgPyBvcHRpb25zLnF1ZXJ5XG4gICAgICAgICAgOiBuZXcgVVJMU2VhcmNoUGFyYW1zKG9wdGlvbnMucXVlcnkpLFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIGAke3VybC5wYXRobmFtZX0ke3VybC5zZWFyY2h9JHt1cmwuaGFzaH1gO1xuICB9XG4gIHJldHVybiByZXBsYWNlZDtcbn1cblxuY2xhc3MgTGF5ZXI8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuPiB7XG4gICNvcHRzOiBMYXllck9wdGlvbnM7XG4gICNwYXJhbU5hbWVzOiBLZXlbXSA9IFtdO1xuICAjcmVnZXhwOiBSZWdFeHA7XG5cbiAgbWV0aG9kczogSFRUUE1ldGhvZHNbXTtcbiAgbmFtZT86IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBzdGFjazogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4gfCBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W10sXG4gICAgeyBuYW1lLCAuLi5vcHRzIH06IExheWVyT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICB0aGlzLiNvcHRzID0gb3B0cztcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMubWV0aG9kcyA9IFsuLi5tZXRob2RzXTtcbiAgICBpZiAodGhpcy5tZXRob2RzLmluY2x1ZGVzKFwiR0VUXCIpKSB7XG4gICAgICB0aGlzLm1ldGhvZHMudW5zaGlmdChcIkhFQURcIik7XG4gICAgfVxuICAgIHRoaXMuc3RhY2sgPSBBcnJheS5pc0FycmF5KG1pZGRsZXdhcmUpID8gbWlkZGxld2FyZS5zbGljZSgpIDogW21pZGRsZXdhcmVdO1xuICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gICAgdGhpcy4jcmVnZXhwID0gcGF0aFRvUmVnZXhwKHBhdGgsIHRoaXMuI3BhcmFtTmFtZXMsIHRoaXMuI29wdHMpO1xuICB9XG5cbiAgY2xvbmUoKTogTGF5ZXI8UiwgUCwgUz4ge1xuICAgIHJldHVybiBuZXcgTGF5ZXIoXG4gICAgICB0aGlzLnBhdGgsXG4gICAgICB0aGlzLm1ldGhvZHMsXG4gICAgICB0aGlzLnN0YWNrLFxuICAgICAgeyBuYW1lOiB0aGlzLm5hbWUsIC4uLnRoaXMuI29wdHMgfSxcbiAgICApO1xuICB9XG5cbiAgbWF0Y2gocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuI3JlZ2V4cC50ZXN0KHBhdGgpO1xuICB9XG5cbiAgcGFyYW1zKFxuICAgIGNhcHR1cmVzOiBzdHJpbmdbXSxcbiAgICBleGlzdGluZ1BhcmFtcyA9IHt9IGFzIFJvdXRlUGFyYW1zPFI+LFxuICApOiBSb3V0ZVBhcmFtczxSPiB7XG4gICAgY29uc3QgcGFyYW1zID0gZXhpc3RpbmdQYXJhbXM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYXB0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuI3BhcmFtTmFtZXNbaV0pIHtcbiAgICAgICAgY29uc3QgYyA9IGNhcHR1cmVzW2ldO1xuICAgICAgICBwYXJhbXNbdGhpcy4jcGFyYW1OYW1lc1tpXS5uYW1lXSA9IGMgPyBkZWNvZGVDb21wb25lbnQoYykgOiBjO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG5cbiAgY2FwdHVyZXMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGlmICh0aGlzLiNvcHRzLmlnbm9yZUNhcHR1cmVzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBwYXRoLm1hdGNoKHRoaXMuI3JlZ2V4cCk/LnNsaWNlKDEpID8/IFtdO1xuICB9XG5cbiAgdXJsKFxuICAgIHBhcmFtcyA9IHt9IGFzIFJvdXRlUGFyYW1zPFI+LFxuICAgIG9wdGlvbnM/OiBVcmxPcHRpb25zLFxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IHRoaXMucGF0aC5yZXBsYWNlKC9cXChcXC5cXCpcXCkvZywgXCJcIik7XG4gICAgcmV0dXJuIHRvVXJsKHVybCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgfVxuXG4gIHBhcmFtKFxuICAgIHBhcmFtOiBzdHJpbmcsXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBmbjogUm91dGVyUGFyYW1NaWRkbGV3YXJlPGFueSwgYW55LCBhbnk+LFxuICApIHtcbiAgICBjb25zdCBzdGFjayA9IHRoaXMuc3RhY2s7XG4gICAgY29uc3QgcGFyYW1zID0gdGhpcy4jcGFyYW1OYW1lcztcbiAgICBjb25zdCBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFI+ID0gZnVuY3Rpb24gKFxuICAgICAgdGhpczogUm91dGVyLFxuICAgICAgY3R4LFxuICAgICAgbmV4dCxcbiAgICApOiBQcm9taXNlPHVua25vd24+IHwgdW5rbm93biB7XG4gICAgICBjb25zdCBwID0gY3R4LnBhcmFtc1twYXJhbV07XG4gICAgICBhc3NlcnQocCk7XG4gICAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBwLCBjdHgsIG5leHQpO1xuICAgIH07XG4gICAgbWlkZGxld2FyZS5wYXJhbSA9IHBhcmFtO1xuXG4gICAgY29uc3QgbmFtZXMgPSBwYXJhbXMubWFwKChwKSA9PiBwLm5hbWUpO1xuXG4gICAgY29uc3QgeCA9IG5hbWVzLmluZGV4T2YocGFyYW0pO1xuICAgIGlmICh4ID49IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZm4gPSBzdGFja1tpXTtcbiAgICAgICAgaWYgKCFmbi5wYXJhbSB8fCBuYW1lcy5pbmRleE9mKGZuLnBhcmFtIGFzIChzdHJpbmcgfCBudW1iZXIpKSA+IHgpIHtcbiAgICAgICAgICBzdGFjay5zcGxpY2UoaSwgMCwgbWlkZGxld2FyZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRQcmVmaXgocHJlZml4OiBzdHJpbmcpOiB0aGlzIHtcbiAgICBpZiAodGhpcy5wYXRoKSB7XG4gICAgICB0aGlzLnBhdGggPSB0aGlzLnBhdGggIT09IFwiL1wiIHx8IHRoaXMuI29wdHMuc3RyaWN0ID09PSB0cnVlXG4gICAgICAgID8gYCR7cHJlZml4fSR7dGhpcy5wYXRofWBcbiAgICAgICAgOiBwcmVmaXg7XG4gICAgICB0aGlzLiNwYXJhbU5hbWVzID0gW107XG4gICAgICB0aGlzLiNyZWdleHAgPSBwYXRoVG9SZWdleHAodGhpcy5wYXRoLCB0aGlzLiNwYXJhbU5hbWVzLCB0aGlzLiNvcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICB0b0pTT04oKTogUm91dGU8YW55LCBhbnksIGFueT4ge1xuICAgIHJldHVybiB7XG4gICAgICBtZXRob2RzOiBbLi4udGhpcy5tZXRob2RzXSxcbiAgICAgIG1pZGRsZXdhcmU6IFsuLi50aGlzLnN0YWNrXSxcbiAgICAgIHBhcmFtTmFtZXM6IHRoaXMuI3BhcmFtTmFtZXMubWFwKChrZXkpID0+IGtleS5uYW1lKSxcbiAgICAgIHBhdGg6IHRoaXMucGF0aCxcbiAgICAgIHJlZ2V4cDogdGhpcy4jcmVnZXhwLFxuICAgICAgb3B0aW9uczogeyAuLi50aGlzLiNvcHRzIH0sXG4gICAgfTtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXShpbnNwZWN0OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZykge1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHtcbiAgICAgICAgbWV0aG9kczogdGhpcy5tZXRob2RzLFxuICAgICAgICBtaWRkbGV3YXJlOiB0aGlzLnN0YWNrLFxuICAgICAgICBvcHRpb25zOiB0aGlzLiNvcHRzLFxuICAgICAgICBwYXJhbU5hbWVzOiB0aGlzLiNwYXJhbU5hbWVzLm1hcCgoa2V5KSA9PiBrZXkubmFtZSksXG4gICAgICAgIHBhdGg6IHRoaXMucGF0aCxcbiAgICAgICAgcmVnZXhwOiB0aGlzLiNyZWdleHAsXG4gICAgICB9KVxuICAgIH1gO1xuICB9XG5cbiAgW1N5bWJvbC5mb3IoXCJub2RlanMudXRpbC5pbnNwZWN0LmN1c3RvbVwiKV0oXG4gICAgZGVwdGg6IG51bWJlcixcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIG9wdGlvbnM6IGFueSxcbiAgICBpbnNwZWN0OiAodmFsdWU6IHVua25vd24sIG9wdGlvbnM/OiB1bmtub3duKSA9PiBzdHJpbmcsXG4gICkge1xuICAgIGlmIChkZXB0aCA8IDApIHtcbiAgICAgIHJldHVybiBvcHRpb25zLnN0eWxpemUoYFske3RoaXMuY29uc3RydWN0b3IubmFtZX1dYCwgXCJzcGVjaWFsXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zLCB7XG4gICAgICBkZXB0aDogb3B0aW9ucy5kZXB0aCA9PT0gbnVsbCA/IG51bGwgOiBvcHRpb25zLmRlcHRoIC0gMSxcbiAgICB9KTtcbiAgICByZXR1cm4gYCR7b3B0aW9ucy5zdHlsaXplKHRoaXMuY29uc3RydWN0b3IubmFtZSwgXCJzcGVjaWFsXCIpfSAke1xuICAgICAgaW5zcGVjdChcbiAgICAgICAge1xuICAgICAgICAgIG1ldGhvZHM6IHRoaXMubWV0aG9kcyxcbiAgICAgICAgICBtaWRkbGV3YXJlOiB0aGlzLnN0YWNrLFxuICAgICAgICAgIG9wdGlvbnM6IHRoaXMuI29wdHMsXG4gICAgICAgICAgcGFyYW1OYW1lczogdGhpcy4jcGFyYW1OYW1lcy5tYXAoKGtleSkgPT4ga2V5Lm5hbWUpLFxuICAgICAgICAgIHBhdGg6IHRoaXMucGF0aCxcbiAgICAgICAgICByZWdleHA6IHRoaXMuI3JlZ2V4cCxcbiAgICAgICAgfSxcbiAgICAgICAgbmV3T3B0aW9ucyxcbiAgICAgIClcbiAgICB9YDtcbiAgfVxufVxuXG4vKiogQW4gaW50ZXJmYWNlIGZvciByZWdpc3RlcmluZyBtaWRkbGV3YXJlIHRoYXQgd2lsbCBydW4gd2hlbiBjZXJ0YWluIEhUVFBcbiAqIG1ldGhvZHMgYW5kIHBhdGhzIGFyZSByZXF1ZXN0ZWQsIGFzIHdlbGwgYXMgcHJvdmlkZXMgYSB3YXkgdG8gcGFyYW1ldGVyaXplXG4gKiBwYXJ0cyBvZiB0aGUgcmVxdWVzdGVkIHBhdGguXG4gKlxuICogIyMjIEJhc2ljIGV4YW1wbGVcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQXBwbGljYXRpb24sIFJvdXRlciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L29hay9tb2QudHNcIjtcbiAqXG4gKiBjb25zdCByb3V0ZXIgPSBuZXcgUm91dGVyKCk7XG4gKiByb3V0ZXIuZ2V0KFwiL1wiLCAoY3R4LCBuZXh0KSA9PiB7XG4gKiAgIC8vIGhhbmRsZSB0aGUgR0VUIGVuZHBvaW50IGhlcmVcbiAqIH0pO1xuICogcm91dGVyLmFsbChcIi9pdGVtLzppdGVtXCIsIChjdHgsIG5leHQpID0+IHtcbiAqICAgLy8gY2FsbGVkIGZvciBhbGwgSFRUUCB2ZXJicy9yZXF1ZXN0c1xuICogICBjdHgucGFyYW1zLml0ZW07IC8vIGNvbnRhaW5zIHRoZSB2YWx1ZSBvZiBgOml0ZW1gIGZyb20gdGhlIHBhcnNlZCBVUkxcbiAqIH0pO1xuICpcbiAqIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbigpO1xuICogYXBwLnVzZShyb3V0ZXIucm91dGVzKCkpO1xuICogYXBwLnVzZShyb3V0ZXIuYWxsb3dlZE1ldGhvZHMoKSk7XG4gKlxuICogYXBwLmxpc3Rlbih7IHBvcnQ6IDgwODAgfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIFJvdXRlcjxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUlMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4sXG4+IHtcbiAgI29wdHM6IFJvdXRlck9wdGlvbnM7XG4gICNtZXRob2RzOiBIVFRQTWV0aG9kc1tdO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAjcGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBSb3V0ZXJQYXJhbU1pZGRsZXdhcmU8YW55LCBhbnksIGFueT4+ID0ge307XG4gICNzdGFjazogTGF5ZXI8c3RyaW5nPltdID0gW107XG5cbiAgI21hdGNoKHBhdGg6IHN0cmluZywgbWV0aG9kOiBIVFRQTWV0aG9kcyk6IE1hdGNoZXM8c3RyaW5nPiB7XG4gICAgY29uc3QgbWF0Y2hlczogTWF0Y2hlczxzdHJpbmc+ID0ge1xuICAgICAgcGF0aDogW10sXG4gICAgICBwYXRoQW5kTWV0aG9kOiBbXSxcbiAgICAgIHJvdXRlOiBmYWxzZSxcbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgaWYgKHJvdXRlLm1hdGNoKHBhdGgpKSB7XG4gICAgICAgIG1hdGNoZXMucGF0aC5wdXNoKHJvdXRlKTtcbiAgICAgICAgaWYgKHJvdXRlLm1ldGhvZHMubGVuZ3RoID09PSAwIHx8IHJvdXRlLm1ldGhvZHMuaW5jbHVkZXMobWV0aG9kKSkge1xuICAgICAgICAgIG1hdGNoZXMucGF0aEFuZE1ldGhvZC5wdXNoKHJvdXRlKTtcbiAgICAgICAgICBpZiAocm91dGUubWV0aG9kcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIG1hdGNoZXMucm91dGUgPSB0cnVlO1xuICAgICAgICAgICAgbWF0Y2hlcy5uYW1lID0gcm91dGUubmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2hlcztcbiAgfVxuXG4gICNyZWdpc3RlcihcbiAgICBwYXRoOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBtaWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgbWV0aG9kczogSFRUUE1ldGhvZHNbXSxcbiAgICBvcHRpb25zOiBSZWdpc3Rlck9wdGlvbnMgPSB7fSxcbiAgKTogdm9pZCB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGF0aCkpIHtcbiAgICAgIGZvciAoY29uc3QgcCBvZiBwYXRoKSB7XG4gICAgICAgIHRoaXMuI3JlZ2lzdGVyKHAsIG1pZGRsZXdhcmVzLCBtZXRob2RzLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgbGF5ZXJNaWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IG1pZGRsZXdhcmUgb2YgbWlkZGxld2FyZXMpIHtcbiAgICAgIGlmICghbWlkZGxld2FyZS5yb3V0ZXIpIHtcbiAgICAgICAgbGF5ZXJNaWRkbGV3YXJlcy5wdXNoKG1pZGRsZXdhcmUpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGxheWVyTWlkZGxld2FyZXMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuI2FkZExheWVyKHBhdGgsIGxheWVyTWlkZGxld2FyZXMsIG1ldGhvZHMsIG9wdGlvbnMpO1xuICAgICAgICBsYXllck1pZGRsZXdhcmVzID0gW107XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJvdXRlciA9IG1pZGRsZXdhcmUucm91dGVyLiNjbG9uZSgpO1xuXG4gICAgICBmb3IgKGNvbnN0IGxheWVyIG9mIHJvdXRlci4jc3RhY2spIHtcbiAgICAgICAgaWYgKCFvcHRpb25zLmlnbm9yZVByZWZpeCkge1xuICAgICAgICAgIGxheWVyLnNldFByZWZpeChwYXRoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy4jb3B0cy5wcmVmaXgpIHtcbiAgICAgICAgICBsYXllci5zZXRQcmVmaXgodGhpcy4jb3B0cy5wcmVmaXgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuI3N0YWNrLnB1c2gobGF5ZXIpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IFtwYXJhbSwgbXddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuI3BhcmFtcykpIHtcbiAgICAgICAgcm91dGVyLnBhcmFtKHBhcmFtLCBtdyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxheWVyTWlkZGxld2FyZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLiNhZGRMYXllcihwYXRoLCBsYXllck1pZGRsZXdhcmVzLCBtZXRob2RzLCBvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICAjYWRkTGF5ZXIoXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdLFxuICAgIG9wdGlvbnM6IExheWVyT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBjb25zdCB7XG4gICAgICBlbmQsXG4gICAgICBuYW1lLFxuICAgICAgc2Vuc2l0aXZlID0gdGhpcy4jb3B0cy5zZW5zaXRpdmUsXG4gICAgICBzdHJpY3QgPSB0aGlzLiNvcHRzLnN0cmljdCxcbiAgICAgIGlnbm9yZUNhcHR1cmVzLFxuICAgIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHJvdXRlID0gbmV3IExheWVyKHBhdGgsIG1ldGhvZHMsIG1pZGRsZXdhcmVzLCB7XG4gICAgICBlbmQsXG4gICAgICBuYW1lLFxuICAgICAgc2Vuc2l0aXZlLFxuICAgICAgc3RyaWN0LFxuICAgICAgaWdub3JlQ2FwdHVyZXMsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy4jb3B0cy5wcmVmaXgpIHtcbiAgICAgIHJvdXRlLnNldFByZWZpeCh0aGlzLiNvcHRzLnByZWZpeCk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBbcGFyYW0sIG13XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLiNwYXJhbXMpKSB7XG4gICAgICByb3V0ZS5wYXJhbShwYXJhbSwgbXcpO1xuICAgIH1cblxuICAgIHRoaXMuI3N0YWNrLnB1c2gocm91dGUpO1xuICB9XG5cbiAgI3JvdXRlKG5hbWU6IHN0cmluZyk6IExheWVyPHN0cmluZz4gfCB1bmRlZmluZWQge1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgdGhpcy4jc3RhY2spIHtcbiAgICAgIGlmIChyb3V0ZS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiByb3V0ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAjdXNlVmVyYihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+LFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgIG1ldGhvZHM6IEhUVFBNZXRob2RzW10sXG4gICk6IHZvaWQge1xuICAgIGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHBhdGg6IHN0cmluZztcbiAgICBpZiAodHlwZW9mIHBhdGhPck1pZGRsZXdhcmUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIG5hbWUgPSBuYW1lT3JQYXRoO1xuICAgICAgcGF0aCA9IHBhdGhPck1pZGRsZXdhcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhdGggPSBuYW1lT3JQYXRoO1xuICAgICAgbWlkZGxld2FyZS51bnNoaWZ0KHBhdGhPck1pZGRsZXdhcmUpO1xuICAgIH1cblxuICAgIHRoaXMuI3JlZ2lzdGVyKHBhdGgsIG1pZGRsZXdhcmUsIG1ldGhvZHMsIHsgbmFtZSB9KTtcbiAgfVxuXG4gICNjbG9uZSgpOiBSb3V0ZXI8UlM+IHtcbiAgICBjb25zdCByb3V0ZXIgPSBuZXcgUm91dGVyPFJTPih0aGlzLiNvcHRzKTtcbiAgICByb3V0ZXIuI21ldGhvZHMgPSByb3V0ZXIuI21ldGhvZHMuc2xpY2UoKTtcbiAgICByb3V0ZXIuI3BhcmFtcyA9IHsgLi4udGhpcy4jcGFyYW1zIH07XG4gICAgcm91dGVyLiNzdGFjayA9IHRoaXMuI3N0YWNrLm1hcCgobGF5ZXIpID0+IGxheWVyLmNsb25lKCkpO1xuICAgIHJldHVybiByb3V0ZXI7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihvcHRzOiBSb3V0ZXJPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLiNvcHRzID0gb3B0cztcbiAgICB0aGlzLiNtZXRob2RzID0gb3B0cy5tZXRob2RzID8/IFtcbiAgICAgIFwiREVMRVRFXCIsXG4gICAgICBcIkdFVFwiLFxuICAgICAgXCJIRUFEXCIsXG4gICAgICBcIk9QVElPTlNcIixcbiAgICAgIFwiUEFUQ0hcIixcbiAgICAgIFwiUE9TVFwiLFxuICAgICAgXCJQVVRcIixcbiAgICBdO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gc3BlY2lmaWVkIG1ldGhvZHNcbiAgICogYXJlIHJlcXVlc3RlZC4gKi9cbiAgYWRkPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbWV0aG9kczogSFRUUE1ldGhvZHNbXSB8IEhUVFBNZXRob2RzLFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIHNwZWNpZmllZCBtZXRob2RzIGlzXG4gICAqIHJlcXVlc3RlZC4gKi9cbiAgYWRkPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbWV0aG9kczogSFRUUE1ldGhvZHNbXSB8IEhUVFBNZXRob2RzLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgc3BlY2lmaWVkIG1ldGhvZHNcbiAgICogYXJlIHJlcXVlc3RlZCB3aXRoIGV4cGxpY2l0IHBhdGggcGFyYW1ldGVycy4gKi9cbiAgYWRkPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG1ldGhvZHM6IEhUVFBNZXRob2RzW10gfCBIVFRQTWV0aG9kcyxcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBhZGQ8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG1ldGhvZHM6IEhUVFBNZXRob2RzW10gfCBIVFRQTWV0aG9kcyxcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+IHtcbiAgICB0aGlzLiN1c2VWZXJiKFxuICAgICAgbmFtZU9yUGF0aCxcbiAgICAgIHBhdGhPck1pZGRsZXdhcmUgYXMgKHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPiksXG4gICAgICBtaWRkbGV3YXJlIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgdHlwZW9mIG1ldGhvZHMgPT09IFwic3RyaW5nXCIgPyBbbWV0aG9kc10gOiBtZXRob2RzLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgbmFtZWQgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYERFTEVURWAsXG4gICAqIGBHRVRgLCBgUE9TVGAsIG9yIGBQVVRgIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGFsbDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBERUxFVEVgLFxuICAgKiBgR0VUYCwgYFBPU1RgLCBvciBgUFVUYCBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBhbGw8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBERUxFVEVgLFxuICAgKiBgR0VUYCwgYFBPU1RgLCBvciBgUFVUYCBtZXRob2QgaXMgcmVxdWVzdGVkIHdpdGggZXhwbGljaXQgcGF0aCBwYXJhbWV0ZXJzLlxuICAgKi9cbiAgYWxsPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIGFsbDxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgdGhpcy4jdXNlVmVyYihcbiAgICAgIG5hbWVPclBhdGgsXG4gICAgICBwYXRoT3JNaWRkbGV3YXJlIGFzIChzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz4pLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIHRoaXMuI21ldGhvZHMuZmlsdGVyKChtZXRob2QpID0+IG1ldGhvZCAhPT0gXCJPUFRJT05TXCIpLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogTWlkZGxld2FyZSB0aGF0IGhhbmRsZXMgcmVxdWVzdHMgZm9yIEhUVFAgbWV0aG9kcyByZWdpc3RlcmVkIHdpdGggdGhlXG4gICAqIHJvdXRlci4gIElmIG5vbmUgb2YgdGhlIHJvdXRlcyBoYW5kbGUgYSBtZXRob2QsIHRoZW4gXCJub3QgYWxsb3dlZFwiIGxvZ2ljXG4gICAqIHdpbGwgYmUgdXNlZC4gIElmIGEgbWV0aG9kIGlzIHN1cHBvcnRlZCBieSBzb21lIHJvdXRlcywgYnV0IG5vdCB0aGVcbiAgICogcGFydGljdWxhciBtYXRjaGVkIHJvdXRlciwgdGhlbiBcIm5vdCBpbXBsZW1lbnRlZFwiIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIFRoZSBtaWRkbGV3YXJlIHdpbGwgYWxzbyBhdXRvbWF0aWNhbGx5IGhhbmRsZSB0aGUgYE9QVElPTlNgIG1ldGhvZCxcbiAgICogcmVzcG9uZGluZyB3aXRoIGEgYDIwMCBPS2Agd2hlbiB0aGUgYEFsbG93ZWRgIGhlYWRlciBzZW50IHRvIHRoZSBhbGxvd2VkXG4gICAqIG1ldGhvZHMgZm9yIGEgZ2l2ZW4gcm91dGUuXG4gICAqXG4gICAqIEJ5IGRlZmF1bHQsIGEgXCJub3QgYWxsb3dlZFwiIHJlcXVlc3Qgd2lsbCByZXNwb25kIHdpdGggYSBgNDA1IE5vdCBBbGxvd2VkYFxuICAgKiBhbmQgYSBcIm5vdCBpbXBsZW1lbnRlZFwiIHdpbGwgcmVzcG9uZCB3aXRoIGEgYDUwMSBOb3QgSW1wbGVtZW50ZWRgLiBTZXR0aW5nXG4gICAqIHRoZSBvcHRpb24gYC50aHJvd2AgdG8gYHRydWVgIHdpbGwgY2F1c2UgdGhlIG1pZGRsZXdhcmUgdG8gdGhyb3cgYW5cbiAgICogYEhUVFBFcnJvcmAgaW5zdGVhZCBvZiBzZXR0aW5nIHRoZSByZXNwb25zZSBzdGF0dXMuICBUaGUgZXJyb3IgY2FuIGJlXG4gICAqIG92ZXJyaWRkZW4gYnkgcHJvdmlkaW5nIGEgYC5ub3RJbXBsZW1lbnRlZGAgb3IgYC5ub3RBbGxvd2VkYCBtZXRob2QgaW4gdGhlXG4gICAqIG9wdGlvbnMsIG9mIHdoaWNoIHRoZSB2YWx1ZSB3aWxsIGJlIHJldHVybmVkIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgdGhlXG4gICAqIEhUVFAgZXJyb3IuICovXG4gIGFsbG93ZWRNZXRob2RzKFxuICAgIG9wdGlvbnM6IFJvdXRlckFsbG93ZWRNZXRob2RzT3B0aW9ucyA9IHt9LFxuICApOiBNaWRkbGV3YXJlIHtcbiAgICBjb25zdCBpbXBsZW1lbnRlZCA9IHRoaXMuI21ldGhvZHM7XG5cbiAgICBjb25zdCBhbGxvd2VkTWV0aG9kczogTWlkZGxld2FyZSA9IGFzeW5jIChjb250ZXh0LCBuZXh0KSA9PiB7XG4gICAgICBjb25zdCBjdHggPSBjb250ZXh0IGFzIFJvdXRlckNvbnRleHQ8c3RyaW5nPjtcbiAgICAgIGF3YWl0IG5leHQoKTtcbiAgICAgIGlmICghY3R4LnJlc3BvbnNlLnN0YXR1cyB8fCBjdHgucmVzcG9uc2Uuc3RhdHVzID09PSBTdGF0dXMuTm90Rm91bmQpIHtcbiAgICAgICAgYXNzZXJ0KGN0eC5tYXRjaGVkKTtcbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQ8SFRUUE1ldGhvZHM+KCk7XG4gICAgICAgIGZvciAoY29uc3Qgcm91dGUgb2YgY3R4Lm1hdGNoZWQpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiByb3V0ZS5tZXRob2RzKSB7XG4gICAgICAgICAgICBhbGxvd2VkLmFkZChtZXRob2QpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbG93ZWRTdHIgPSBbLi4uYWxsb3dlZF0uam9pbihcIiwgXCIpO1xuICAgICAgICBpZiAoIWltcGxlbWVudGVkLmluY2x1ZGVzKGN0eC5yZXF1ZXN0Lm1ldGhvZCkpIHtcbiAgICAgICAgICBpZiAob3B0aW9ucy50aHJvdykge1xuICAgICAgICAgICAgdGhyb3cgb3B0aW9ucy5ub3RJbXBsZW1lbnRlZFxuICAgICAgICAgICAgICA/IG9wdGlvbnMubm90SW1wbGVtZW50ZWQoKVxuICAgICAgICAgICAgICA6IG5ldyBlcnJvcnMuTm90SW1wbGVtZW50ZWQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IFN0YXR1cy5Ob3RJbXBsZW1lbnRlZDtcbiAgICAgICAgICAgIGN0eC5yZXNwb25zZS5oZWFkZXJzLnNldChcIkFsbG93XCIsIGFsbG93ZWRTdHIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhbGxvd2VkLnNpemUpIHtcbiAgICAgICAgICBpZiAoY3R4LnJlcXVlc3QubWV0aG9kID09PSBcIk9QVElPTlNcIikge1xuICAgICAgICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IFN0YXR1cy5PSztcbiAgICAgICAgICAgIGN0eC5yZXNwb25zZS5oZWFkZXJzLnNldChcIkFsbG93XCIsIGFsbG93ZWRTdHIpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoIWFsbG93ZWQuaGFzKGN0eC5yZXF1ZXN0Lm1ldGhvZCkpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnRocm93KSB7XG4gICAgICAgICAgICAgIHRocm93IG9wdGlvbnMubWV0aG9kTm90QWxsb3dlZFxuICAgICAgICAgICAgICAgID8gb3B0aW9ucy5tZXRob2ROb3RBbGxvd2VkKClcbiAgICAgICAgICAgICAgICA6IG5ldyBlcnJvcnMuTWV0aG9kTm90QWxsb3dlZCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IFN0YXR1cy5NZXRob2ROb3RBbGxvd2VkO1xuICAgICAgICAgICAgICBjdHgucmVzcG9uc2UuaGVhZGVycy5zZXQoXCJBbGxvd1wiLCBhbGxvd2VkU3RyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGFsbG93ZWRNZXRob2RzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBERUxFVEVgLFxuICAgKiAgbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgZGVsZXRlPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYERFTEVURWAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGRlbGV0ZTxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYERFTEVURWAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQgd2l0aCBleHBsaWNpdCBwYXRoIHBhcmFtZXRlcnMuICovXG4gIGRlbGV0ZTxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBkZWxldGU8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJERUxFVEVcIl0sXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJvdXRlcyBjdXJyZW50bHkgYWRkZWQgdG8gdGhlIHJvdXRlci4gIFRvIGJlIGNvbXBhdGlibGVcbiAgICogd2l0aCB0aGUgaXRlcmFibGUgaW50ZXJmYWNlcywgYm90aCB0aGUga2V5IGFuZCB2YWx1ZSBhcmUgc2V0IHRvIHRoZSB2YWx1ZVxuICAgKiBvZiB0aGUgcm91dGUuICovXG4gICplbnRyaWVzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W1JvdXRlPHN0cmluZz4sIFJvdXRlPHN0cmluZz5dPiB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgY29uc3QgdmFsdWUgPSByb3V0ZS50b0pTT04oKTtcbiAgICAgIHlpZWxkIFt2YWx1ZSwgdmFsdWVdO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJvdXRlcyBjdXJyZW50bHkgYWRkZWQgdG8gdGhlIHJvdXRlciwgY2FsbGluZyB0aGVcbiAgICogYGNhbGxiYWNrYCBmdW5jdGlvbiBmb3IgZWFjaCB2YWx1ZS4gKi9cbiAgZm9yRWFjaChcbiAgICBjYWxsYmFjazogKFxuICAgICAgdmFsdWUxOiBSb3V0ZTxzdHJpbmc+LFxuICAgICAgdmFsdWUyOiBSb3V0ZTxzdHJpbmc+LFxuICAgICAgcm91dGVyOiB0aGlzLFxuICAgICkgPT4gdm9pZCxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRoaXNBcmc6IGFueSA9IG51bGwsXG4gICk6IHZvaWQge1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgdGhpcy4jc3RhY2spIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gcm91dGUudG9KU09OKCk7XG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHZhbHVlLCB2YWx1ZSwgdGhpcyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBHRVRgLFxuICAgKiAgbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgZ2V0PFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYEdFVGAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGdldDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYEdFVGAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQgd2l0aCBleHBsaWNpdCBwYXRoIHBhcmFtZXRlcnMuICovXG4gIGdldDxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBnZXQ8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJHRVRcIl0sXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBSZWdpc3RlciBuYW1lZCBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgSEVBRGAsXG4gICAqICBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBoZWFkPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYEhFQURgLFxuICAgKiBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBoZWFkPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgSEVBRGAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQgd2l0aCBleHBsaWNpdCBwYXRoIHBhcmFtZXRlcnMuICovXG4gIGhlYWQ8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgaGVhZDxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgdGhpcy4jdXNlVmVyYihcbiAgICAgIG5hbWVPclBhdGgsXG4gICAgICBwYXRoT3JNaWRkbGV3YXJlIGFzIChzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz4pLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIFtcIkhFQURcIl0sXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJvdXRlcyBjdXJyZW50bHkgYWRkZWQgdG8gdGhlIHJvdXRlci4gIFRvIGJlIGNvbXBhdGlibGVcbiAgICogd2l0aCB0aGUgaXRlcmFibGUgaW50ZXJmYWNlcywgdGhlIGtleSBpcyBzZXQgdG8gdGhlIHZhbHVlIG9mIHRoZSByb3V0ZS4gKi9cbiAgKmtleXMoKTogSXRlcmFibGVJdGVyYXRvcjxSb3V0ZTxzdHJpbmc+PiB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgeWllbGQgcm91dGUudG9KU09OKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBPUFRJT05TYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgb3B0aW9uczxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBPUFRJT05TYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgb3B0aW9uczxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYE9QVElPTlNgLFxuICAgKiBtZXRob2QgaXMgcmVxdWVzdGVkIHdpdGggZXhwbGljaXQgcGF0aCBwYXJhbWV0ZXJzLiAqL1xuICBvcHRpb25zPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIG9wdGlvbnM8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJPUFRJT05TXCJdLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgcGFyYW0gbWlkZGxld2FyZSwgd2hpY2ggd2lsbCBiZSBjYWxsZWQgd2hlbiB0aGUgcGFydGljdWxhciBwYXJhbVxuICAgKiBpcyBwYXJzZWQgZnJvbSB0aGUgcm91dGUuICovXG4gIHBhcmFtPFIgZXh0ZW5kcyBzdHJpbmcsIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTPihcbiAgICBwYXJhbToga2V5b2YgUm91dGVQYXJhbXM8Uj4sXG4gICAgbWlkZGxld2FyZTogUm91dGVyUGFyYW1NaWRkbGV3YXJlPFIsIFJvdXRlUGFyYW1zPFI+LCBTPixcbiAgKTogUm91dGVyPFM+IHtcbiAgICB0aGlzLiNwYXJhbXNbcGFyYW0gYXMgc3RyaW5nXSA9IG1pZGRsZXdhcmU7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgcm91dGUucGFyYW0ocGFyYW0gYXMgc3RyaW5nLCBtaWRkbGV3YXJlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgbmFtZWQgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBBVENIYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcGF0Y2g8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgUEFUQ0hgLFxuICAgKiBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBwYXRjaDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBBVENIYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZCB3aXRoIGV4cGxpY2l0IHBhdGggcGFyYW1ldGVycy4gKi9cbiAgcGF0Y2g8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgcGF0Y2g8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJQQVRDSFwiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQT1NUYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcG9zdDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQT1NUYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcG9zdDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBPU1RgLFxuICAgKiBtZXRob2QgaXMgcmVxdWVzdGVkIHdpdGggZXhwbGljaXQgcGF0aCBwYXJhbWV0ZXJzLiAqL1xuICBwb3N0PFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIHBvc3Q8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJQT1NUXCJdLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogU2V0IHRoZSByb3V0ZXIgcHJlZml4IGZvciB0aGlzIHJvdXRlci4gKi9cbiAgcHJlZml4KHByZWZpeDogc3RyaW5nKTogdGhpcyB7XG4gICAgcHJlZml4ID0gcHJlZml4LnJlcGxhY2UoL1xcLyQvLCBcIlwiKTtcbiAgICB0aGlzLiNvcHRzLnByZWZpeCA9IHByZWZpeDtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMuI3N0YWNrKSB7XG4gICAgICByb3V0ZS5zZXRQcmVmaXgocHJlZml4KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgbmFtZWQgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBVVGBcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcHV0PFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBVVGBcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcHV0PFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgUFVUYFxuICAgKiBtZXRob2QgaXMgcmVxdWVzdGVkIHdpdGggZXhwbGljaXQgcGF0aCBwYXJhbWV0ZXJzLiAqL1xuICBwdXQ8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgcHV0PFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+IHtcbiAgICB0aGlzLiN1c2VWZXJiKFxuICAgICAgbmFtZU9yUGF0aCxcbiAgICAgIHBhdGhPck1pZGRsZXdhcmUgYXMgKHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPiksXG4gICAgICBtaWRkbGV3YXJlIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgW1wiUFVUXCJdLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgYSBkaXJlY3Rpb24gbWlkZGxld2FyZSwgd2hlcmUgd2hlbiB0aGUgYHNvdXJjZWAgcGF0aCBpcyBtYXRjaGVkXG4gICAqIHRoZSByb3V0ZXIgd2lsbCByZWRpcmVjdCB0aGUgcmVxdWVzdCB0byB0aGUgYGRlc3RpbmF0aW9uYCBwYXRoLiAgQSBgc3RhdHVzYFxuICAgKiBvZiBgMzAyIEZvdW5kYCB3aWxsIGJlIHNldCBieSBkZWZhdWx0LlxuICAgKlxuICAgKiBUaGUgYHNvdXJjZWAgYW5kIGBkZXN0aW5hdGlvbmAgY2FuIGJlIG5hbWVkIHJvdXRlcy4gKi9cbiAgcmVkaXJlY3QoXG4gICAgc291cmNlOiBzdHJpbmcsXG4gICAgZGVzdGluYXRpb246IHN0cmluZyB8IFVSTCxcbiAgICBzdGF0dXM6IFJlZGlyZWN0U3RhdHVzID0gU3RhdHVzLkZvdW5kLFxuICApOiB0aGlzIHtcbiAgICBpZiAoc291cmNlWzBdICE9PSBcIi9cIikge1xuICAgICAgY29uc3QgcyA9IHRoaXMudXJsKHNvdXJjZSk7XG4gICAgICBpZiAoIXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYENvdWxkIG5vdCByZXNvbHZlIG5hbWVkIHJvdXRlOiBcIiR7c291cmNlfVwiYCk7XG4gICAgICB9XG4gICAgICBzb3VyY2UgPSBzO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGRlc3RpbmF0aW9uID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBpZiAoZGVzdGluYXRpb25bMF0gIT09IFwiL1wiKSB7XG4gICAgICAgIGNvbnN0IGQgPSB0aGlzLnVybChkZXN0aW5hdGlvbik7XG4gICAgICAgIGlmICghZCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKGRlc3RpbmF0aW9uKTtcbiAgICAgICAgICAgIGRlc3RpbmF0aW9uID0gdXJsO1xuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYENvdWxkIG5vdCByZXNvbHZlIG5hbWVkIHJvdXRlOiBcIiR7c291cmNlfVwiYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlc3RpbmF0aW9uID0gZDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuYWxsKHNvdXJjZSwgYXN5bmMgKGN0eCwgbmV4dCkgPT4ge1xuICAgICAgYXdhaXQgbmV4dCgpO1xuICAgICAgY3R4LnJlc3BvbnNlLnJlZGlyZWN0KGRlc3RpbmF0aW9uKTtcbiAgICAgIGN0eC5yZXNwb25zZS5zdGF0dXMgPSBzdGF0dXM7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogUmV0dXJuIG1pZGRsZXdhcmUgdGhhdCB3aWxsIGRvIGFsbCB0aGUgcm91dGUgcHJvY2Vzc2luZyB0aGF0IHRoZSByb3V0ZXJcbiAgICogaGFzIGJlZW4gY29uZmlndXJlZCB0byBoYW5kbGUuICBUeXBpY2FsIHVzYWdlIHdvdWxkIGJlIHNvbWV0aGluZyBsaWtlIHRoaXM6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IEFwcGxpY2F0aW9uLCBSb3V0ZXIgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQveC9vYWsvbW9kLnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbigpO1xuICAgKiBjb25zdCByb3V0ZXIgPSBuZXcgUm91dGVyKCk7XG4gICAqXG4gICAqIC8vIHJlZ2lzdGVyIHJvdXRlc1xuICAgKlxuICAgKiBhcHAudXNlKHJvdXRlci5yb3V0ZXMoKSk7XG4gICAqIGFwcC51c2Uocm91dGVyLmFsbG93ZWRNZXRob2RzKCkpO1xuICAgKiBhd2FpdCBhcHAubGlzdGVuKHsgcG9ydDogODAgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgcm91dGVzKCk6IE1pZGRsZXdhcmUge1xuICAgIGNvbnN0IGRpc3BhdGNoID0gKFxuICAgICAgY29udGV4dDogQ29udGV4dCxcbiAgICAgIG5leHQ6ICgpID0+IFByb21pc2U8dW5rbm93bj4sXG4gICAgKTogUHJvbWlzZTx1bmtub3duPiA9PiB7XG4gICAgICBjb25zdCBjdHggPSBjb250ZXh0IGFzIFJvdXRlckNvbnRleHQ8c3RyaW5nPjtcbiAgICAgIGxldCBwYXRobmFtZTogc3RyaW5nO1xuICAgICAgbGV0IG1ldGhvZDogSFRUUE1ldGhvZHM7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB7IHVybDogeyBwYXRobmFtZTogcCB9LCBtZXRob2Q6IG0gfSA9IGN0eC5yZXF1ZXN0O1xuICAgICAgICBwYXRobmFtZSA9IHA7XG4gICAgICAgIG1ldGhvZCA9IG07XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHBhdGggPSB0aGlzLiNvcHRzLnJvdXRlclBhdGggPz8gY3R4LnJvdXRlclBhdGggPz9cbiAgICAgICAgZGVjb2RlVVJJKHBhdGhuYW1lKTtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSB0aGlzLiNtYXRjaChwYXRoLCBtZXRob2QpO1xuXG4gICAgICBpZiAoY3R4Lm1hdGNoZWQpIHtcbiAgICAgICAgY3R4Lm1hdGNoZWQucHVzaCguLi5tYXRjaGVzLnBhdGgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3R4Lm1hdGNoZWQgPSBbLi4ubWF0Y2hlcy5wYXRoXTtcbiAgICAgIH1cblxuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGN0eC5yb3V0ZXIgPSB0aGlzIGFzIFJvdXRlcjxhbnk+O1xuXG4gICAgICBpZiAoIW1hdGNoZXMucm91dGUpIHJldHVybiBuZXh0KCk7XG5cbiAgICAgIGN0eC5yb3V0ZU5hbWUgPSBtYXRjaGVzLm5hbWU7XG5cbiAgICAgIGNvbnN0IHsgcGF0aEFuZE1ldGhvZDogbWF0Y2hlZFJvdXRlcyB9ID0gbWF0Y2hlcztcblxuICAgICAgY29uc3QgY2hhaW4gPSBtYXRjaGVkUm91dGVzLnJlZHVjZShcbiAgICAgICAgKHByZXYsIHJvdXRlKSA9PiBbXG4gICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAoY3R4LCBuZXh0KSA9PiB7XG4gICAgICAgICAgICBjdHguY2FwdHVyZXMgPSByb3V0ZS5jYXB0dXJlcyhwYXRoKTtcbiAgICAgICAgICAgIGN0eC5wYXJhbXMgPSByb3V0ZS5wYXJhbXMoY3R4LmNhcHR1cmVzLCBjdHgucGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi5yb3V0ZS5zdGFjayxcbiAgICAgICAgXSxcbiAgICAgICAgW10gYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICApO1xuICAgICAgcmV0dXJuIGNvbXBvc2UoY2hhaW4pKGN0eCwgbmV4dCk7XG4gICAgfTtcbiAgICBkaXNwYXRjaC5yb3V0ZXIgPSB0aGlzO1xuICAgIHJldHVybiBkaXNwYXRjaDtcbiAgfVxuXG4gIC8qKiBHZW5lcmF0ZSBhIFVSTCBwYXRobmFtZSBmb3IgYSBuYW1lZCByb3V0ZSwgaW50ZXJwb2xhdGluZyB0aGUgb3B0aW9uYWxcbiAgICogcGFyYW1zIHByb3ZpZGVkLiAgQWxzbyBhY2NlcHRzIGFuIG9wdGlvbmFsIHNldCBvZiBvcHRpb25zLiAqL1xuICB1cmw8UCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+PihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGFyYW1zPzogUCxcbiAgICBvcHRpb25zPzogVXJsT3B0aW9ucyxcbiAgKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCByb3V0ZSA9IHRoaXMuI3JvdXRlKG5hbWUpO1xuXG4gICAgaWYgKHJvdXRlKSB7XG4gICAgICByZXR1cm4gcm91dGUudXJsKHBhcmFtcywgb3B0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgdG8gYmUgdXNlZCBvbiBldmVyeSBtYXRjaGVkIHJvdXRlLiAqL1xuICB1c2U8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIHRvIGJlIHVzZWQgb24gZXZlcnkgcm91dGUgdGhhdCBtYXRjaGVzIHRoZSBzdXBwbGllZFxuICAgKiBgcGF0aGAuICovXG4gIHVzZTxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSB0byBiZSB1c2VkIG9uIGV2ZXJ5IHJvdXRlIHRoYXQgbWF0Y2hlcyB0aGUgc3VwcGxpZWRcbiAgICogYHBhdGhgIHdpdGggZXhwbGljaXQgcGF0aCBwYXJhbWV0ZXJzLiAqL1xuICB1c2U8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogc3RyaW5nLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIHVzZTxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogc3RyaW5nW10sXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgdXNlPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBzdHJpbmdbXSB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgbGV0IHBhdGg6IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBwYXRoT3JNaWRkbGV3YXJlID09PSBcInN0cmluZ1wiIHx8IEFycmF5LmlzQXJyYXkocGF0aE9yTWlkZGxld2FyZSlcbiAgICApIHtcbiAgICAgIHBhdGggPSBwYXRoT3JNaWRkbGV3YXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICBtaWRkbGV3YXJlLnVuc2hpZnQocGF0aE9yTWlkZGxld2FyZSk7XG4gICAgfVxuXG4gICAgdGhpcy4jcmVnaXN0ZXIoXG4gICAgICBwYXRoID8/IFwiKC4qKVwiLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIFtdLFxuICAgICAgeyBlbmQ6IGZhbHNlLCBpZ25vcmVDYXB0dXJlczogIXBhdGgsIGlnbm9yZVByZWZpeDogIXBhdGggfSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSByb3V0ZXMgY3VycmVudGx5IGFkZGVkIHRvIHRoZSByb3V0ZXIuICovXG4gICp2YWx1ZXMoKTogSXRlcmFibGVJdGVyYXRvcjxSb3V0ZTxzdHJpbmcsIFJvdXRlUGFyYW1zPHN0cmluZz4sIFJTPj4ge1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgdGhpcy4jc3RhY2spIHtcbiAgICAgIHlpZWxkIHJvdXRlLnRvSlNPTigpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBQcm92aWRlIGFuIGl0ZXJhdG9yIGludGVyZmFjZSB0aGF0IGl0ZXJhdGVzIG92ZXIgdGhlIHJvdXRlcyByZWdpc3RlcmVkXG4gICAqIHdpdGggdGhlIHJvdXRlci4gKi9cbiAgKltTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8XG4gICAgUm91dGU8c3RyaW5nLCBSb3V0ZVBhcmFtczxzdHJpbmc+LCBSUz5cbiAgPiB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgeWllbGQgcm91dGUudG9KU09OKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEdlbmVyYXRlIGEgVVJMIHBhdGhuYW1lIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBwYXRoLCBpbnRlcnBvbGF0aW5nIHRoZVxuICAgKiBvcHRpb25hbCBwYXJhbXMgcHJvdmlkZWQuICBBbHNvIGFjY2VwdHMgYW4gb3B0aW9uYWwgc2V0IG9mIG9wdGlvbnMuICovXG4gIHN0YXRpYyB1cmw8UiBleHRlbmRzIHN0cmluZz4oXG4gICAgcGF0aDogUixcbiAgICBwYXJhbXM/OiBSb3V0ZVBhcmFtczxSPixcbiAgICBvcHRpb25zPzogVXJsT3B0aW9ucyxcbiAgKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdG9VcmwocGF0aCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXShpbnNwZWN0OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZykge1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHsgXCIjcGFyYW1zXCI6IHRoaXMuI3BhcmFtcywgXCIjc3RhY2tcIjogdGhpcy4jc3RhY2sgfSlcbiAgICB9YDtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwibm9kZWpzLnV0aWwuaW5zcGVjdC5jdXN0b21cIildKFxuICAgIGRlcHRoOiBudW1iZXIsXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBvcHRpb25zOiBhbnksXG4gICAgaW5zcGVjdDogKHZhbHVlOiB1bmtub3duLCBvcHRpb25zPzogdW5rbm93bikgPT4gc3RyaW5nLFxuICApIHtcbiAgICBpZiAoZGVwdGggPCAwKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5zdHlsaXplKGBbJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9XWAsIFwic3BlY2lhbFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdPcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge1xuICAgICAgZGVwdGg6IG9wdGlvbnMuZGVwdGggPT09IG51bGwgPyBudWxsIDogb3B0aW9ucy5kZXB0aCAtIDEsXG4gICAgfSk7XG4gICAgcmV0dXJuIGAke29wdGlvbnMuc3R5bGl6ZSh0aGlzLmNvbnN0cnVjdG9yLm5hbWUsIFwic3BlY2lhbFwiKX0gJHtcbiAgICAgIGluc3BlY3QoXG4gICAgICAgIHsgXCIjcGFyYW1zXCI6IHRoaXMuI3BhcmFtcywgXCIjc3RhY2tcIjogdGhpcy4jc3RhY2sgfSxcbiAgICAgICAgbmV3T3B0aW9ucyxcbiAgICAgIClcbiAgICB9YDtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBeUJDLEdBSUQsU0FDRSxPQUFPLEVBQ1AsTUFBTSxFQUlOLFNBQVMsRUFDVCxZQUFZLEVBRVosTUFBTSxRQUVELFlBQVk7QUFDbkIsU0FBUyxPQUFPLFFBQW9CLGtCQUFrQjtBQUN0RCxTQUFTLE1BQU0sRUFBRSxlQUFlLFFBQVEsWUFBWTtBQWtMcEQ7V0FDVyxHQUNYLFNBQVMsTUFDUCxHQUFXLEVBQ1gsU0FBUyxDQUFDLENBQW1CLEVBQzdCLE9BQW9CO0VBRXBCLE1BQU0sU0FBUyxVQUFVO0VBQ3pCLElBQUksVUFBVSxDQUFDO0VBRWYsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLFFBQVUsT0FBTyxVQUFVLFdBQVc7SUFDckQsVUFBVTtFQUNaLE9BQU87SUFDTCxVQUFVO0VBQ1o7RUFFQSxNQUFNLFNBQVMsUUFBUSxLQUFLO0VBQzVCLE1BQU0sV0FBVyxPQUFPO0VBRXhCLElBQUksV0FBVyxRQUFRLEtBQUssRUFBRTtJQUM1QixNQUFNLE1BQU0sSUFBSSxJQUFJLFVBQVU7SUFDOUIsSUFBSSxPQUFPLFFBQVEsS0FBSyxLQUFLLFVBQVU7TUFDckMsSUFBSSxNQUFNLEdBQUcsUUFBUSxLQUFLO0lBQzVCLE9BQU87TUFDTCxJQUFJLE1BQU0sR0FBRyxPQUNYLFFBQVEsS0FBSyxZQUFZLGtCQUNyQixRQUFRLEtBQUssR0FDYixJQUFJLGdCQUFnQixRQUFRLEtBQUs7SUFFekM7SUFDQSxPQUFPLENBQUMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxFQUFFLElBQUksTUFBTSxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQztFQUNsRDtFQUNBLE9BQU87QUFDVDtBQUVBLE1BQU07RUFNSixDQUFDLElBQUksQ0FB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