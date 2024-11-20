// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.
import { Context } from "./context.ts";
import { KeyStack, STATUS_TEXT } from "./deps.ts";
import { HttpServer } from "./http_server_native.ts";
import { NativeRequest } from "./http_server_native_request.ts";
import { compose, isMiddlewareObject } from "./middleware.ts";
import { cloneState } from "./structured_clone.ts";
import { assert, isConn } from "./util.ts";
const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;
const DEFAULT_SERVER = HttpServer;
export class ApplicationCloseEvent extends Event {
  constructor(eventInitDict){
    super("close", eventInitDict);
  }
}
export class ApplicationErrorEvent extends ErrorEvent {
  context;
  constructor(eventInitDict){
    super("error", eventInitDict);
    this.context = eventInitDict.context;
  }
}
function logErrorListener({ error, context }) {
  if (error instanceof Error) {
    console.error(`[uncaught application error]: ${error.name} - ${error.message}`);
  } else {
    console.error(`[uncaught application error]\n`, error);
  }
  if (context) {
    let url;
    try {
      url = context.request.url.toString();
    } catch  {
      url = "[malformed url]";
    }
    console.error(`\nrequest:`, {
      url,
      method: context.request.method,
      hasBody: context.request.hasBody
    });
    console.error(`response:`, {
      status: context.response.status,
      type: context.response.type,
      hasBody: !!context.response.body,
      writable: context.response.writable
    });
  }
  if (error instanceof Error && error.stack) {
    console.error(`\n${error.stack.split("\n").slice(1).join("\n")}`);
  }
}
export class ApplicationListenEvent extends Event {
  hostname;
  listener;
  port;
  secure;
  serverType;
  constructor(eventInitDict){
    super("listen", eventInitDict);
    this.hostname = eventInitDict.hostname;
    this.listener = eventInitDict.listener;
    this.port = eventInitDict.port;
    this.secure = eventInitDict.secure;
    this.serverType = eventInitDict.serverType;
  }
}
/** A class which registers middleware (via `.use()`) and then processes
 * inbound requests against that middleware (via `.listen()`).
 *
 * The `context.state` can be typed via passing a generic argument when
 * constructing an instance of `Application`. It can also be inferred by setting
 * the {@linkcode ApplicationOptions.state} option when constructing the
 * application.
 *
 * ### Basic example
 *
 * ```ts
 * import { Application } from "https://deno.land/x/oak/mod.ts";
 *
 * const app = new Application();
 *
 * app.use((ctx, next) => {
 *   // called on each request with the context (`ctx`) of the request,
 *   // response, and other data.
 *   // `next()` is use to modify the flow control of the middleware stack.
 * });
 *
 * app.listen({ port: 8080 });
 * ```
 *
 * @template AS the type of the application state which extends
 *              {@linkcode State} and defaults to a simple string record.
 */ // deno-lint-ignore no-explicit-any
export class Application extends EventTarget {
  #composedMiddleware;
  #contextOptions;
  #contextState;
  #keys;
  #middleware = [];
  #serverConstructor;
  /** A set of keys, or an instance of `KeyStack` which will be used to sign
   * cookies read and set by the application to avoid tampering with the
   * cookies. */ get keys() {
    return this.#keys;
  }
  set keys(keys) {
    if (!keys) {
      this.#keys = undefined;
      return;
    } else if (Array.isArray(keys)) {
      this.#keys = new KeyStack(keys);
    } else {
      this.#keys = keys;
    }
  }
  /** If `true`, proxy headers will be trusted when processing requests.  This
   * defaults to `false`. */ proxy;
  /** Generic state of the application, which can be specified by passing the
   * generic argument when constructing:
   *
   *       const app = new Application<{ foo: string }>();
   *
   * Or can be contextually inferred based on setting an initial state object:
   *
   *       const app = new Application({ state: { foo: "bar" } });
   *
   * When a new context is created, the application's state is cloned and the
   * state is unique to that request/response.  Changes can be made to the
   * application state that will be shared with all contexts.
   */ state;
  constructor(options = {}){
    super();
    const { state, keys, proxy, serverConstructor = DEFAULT_SERVER, contextState = "clone", logErrors = true, ...contextOptions } = options;
    this.proxy = proxy ?? false;
    this.keys = keys;
    this.state = state ?? {};
    this.#serverConstructor = serverConstructor;
    this.#contextOptions = contextOptions;
    this.#contextState = contextState;
    if (logErrors) {
      this.addEventListener("error", logErrorListener);
    }
  }
  #getComposed() {
    if (!this.#composedMiddleware) {
      this.#composedMiddleware = compose(this.#middleware);
    }
    return this.#composedMiddleware;
  }
  #getContextState() {
    switch(this.#contextState){
      case "alias":
        return this.state;
      case "clone":
        return cloneState(this.state);
      case "empty":
        return {};
      case "prototype":
        return Object.create(this.state);
    }
  }
  /** Deal with uncaught errors in either the middleware or sending the
   * response. */ // deno-lint-ignore no-explicit-any
  #handleError(context, error) {
    if (!(error instanceof Error)) {
      error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
    }
    const { message } = error;
    this.dispatchEvent(new ApplicationErrorEvent({
      context,
      message,
      error
    }));
    if (!context.response.writable) {
      return;
    }
    for (const key of [
      ...context.response.headers.keys()
    ]){
      context.response.headers.delete(key);
    }
    if (error.headers && error.headers instanceof Headers) {
      for (const [key, value] of error.headers){
        context.response.headers.set(key, value);
      }
    }
    context.response.type = "text";
    const status = context.response.status = Deno.errors && error instanceof Deno.errors.NotFound ? 404 : error.status && typeof error.status === "number" ? error.status : 500;
    context.response.body = error.expose ? error.message : STATUS_TEXT[status];
  }
  /** Processing registered middleware on each request. */ async #handleRequest(request, secure, state) {
    let context;
    try {
      context = new Context(this, request, this.#getContextState(), {
        secure,
        ...this.#contextOptions
      });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(`non-error thrown: ${JSON.stringify(e)}`);
      const { message } = error;
      this.dispatchEvent(new ApplicationErrorEvent({
        message,
        error
      }));
      return;
    }
    assert(context, "Context was not created.");
    let resolve;
    const handlingPromise = new Promise((res)=>resolve = res);
    state.handling.add(handlingPromise);
    if (!state.closing && !state.closed) {
      try {
        await this.#getComposed()(context);
      } catch (err) {
        this.#handleError(context, err);
      }
    }
    if (context.respond === false) {
      context.response.destroy();
      resolve();
      state.handling.delete(handlingPromise);
      return;
    }
    let closeResources = true;
    let response;
    try {
      closeResources = false;
      response = await context.response.toDomResponse();
    } catch (err) {
      this.#handleError(context, err);
      response = await context.response.toDomResponse();
    }
    assert(response);
    try {
      await request.respond(response);
    } catch (err) {
      this.#handleError(context, err);
    } finally{
      context.response.destroy(closeResources);
      resolve();
      state.handling.delete(handlingPromise);
      if (state.closing) {
        await state.server.close();
        if (!state.closed) {
          this.dispatchEvent(new ApplicationCloseEvent({}));
        }
        state.closed = true;
      }
    }
  }
  /** Add an event listener for an event.  Currently valid event types are
   * `"error"` and `"listen"`. */ addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
  }
  /** Handle an individual server request, returning the server response.  This
   * is similar to `.listen()`, but opening the connection and retrieving
   * requests are not the responsibility of the application.  If the generated
   * context gets set to not to respond, then the method resolves with
   * `undefined`, otherwise it resolves with a request that is compatible with
   * `std/http/server`. */ handle = async (request, secureOrConn, secure = false)=>{
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    assert(isConn(secureOrConn) || typeof secureOrConn === "undefined");
    const contextRequest = new NativeRequest({
      request,
      respondWith () {
        return Promise.resolve(undefined);
      }
    }, {
      conn: secureOrConn
    });
    const context = new Context(this, contextRequest, this.#getContextState(), {
      secure,
      ...this.#contextOptions
    });
    try {
      await this.#getComposed()(context);
    } catch (err) {
      this.#handleError(context, err);
    }
    if (context.respond === false) {
      context.response.destroy();
      return;
    }
    try {
      const response = await context.response.toDomResponse();
      context.response.destroy(false);
      return response;
    } catch (err) {
      this.#handleError(context, err);
      throw err;
    }
  };
  async listen(options = {
    port: 0
  }) {
    if (!this.#middleware.length) {
      throw new TypeError("There is no middleware to process requests.");
    }
    for (const middleware of this.#middleware){
      if (isMiddlewareObject(middleware) && middleware.init) {
        await middleware.init();
      }
    }
    if (typeof options === "string") {
      const match = ADDR_REGEXP.exec(options);
      if (!match) {
        throw TypeError(`Invalid address passed: "${options}"`);
      }
      const [, hostname, portStr] = match;
      options = {
        hostname,
        port: parseInt(portStr, 10)
      };
    }
    options = Object.assign({
      port: 0
    }, options);
    const server = new this.#serverConstructor(this, options);
    const { signal } = options;
    const state = {
      closed: false,
      closing: false,
      handling: new Set(),
      server
    };
    if (signal) {
      signal.addEventListener("abort", ()=>{
        if (!state.handling.size) {
          server.close();
          state.closed = true;
          this.dispatchEvent(new ApplicationCloseEvent({}));
        }
        state.closing = true;
      });
    }
    const { secure = false } = options;
    const serverType = server instanceof HttpServer ? "native" : "custom";
    const listener = await server.listen();
    const { hostname, port } = listener.addr;
    this.dispatchEvent(new ApplicationListenEvent({
      hostname,
      listener,
      port,
      secure,
      serverType
    }));
    try {
      for await (const request of server){
        this.#handleRequest(request, secure, state);
      }
      await Promise.all(state.handling);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Application Error";
      this.dispatchEvent(new ApplicationErrorEvent({
        message,
        error
      }));
    }
  }
  use(...middleware) {
    this.#middleware.push(...middleware);
    this.#composedMiddleware = undefined;
    // deno-lint-ignore no-explicit-any
    return this;
  }
  [Symbol.for("Deno.customInspect")](inspect) {
    const { keys, proxy, state } = this;
    return `${this.constructor.name} ${inspect({
      "#middleware": this.#middleware,
      keys,
      proxy,
      state
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
    const { keys, proxy, state } = this;
    return `${options.stylize(this.constructor.name, "special")} ${inspect({
      "#middleware": this.#middleware,
      keys,
      proxy,
      state
    }, newOptions)}`;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrQHYxMi42LjEvYXBwbGljYXRpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgb2FrIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBDb250ZXh0IH0gZnJvbSBcIi4vY29udGV4dC50c1wiO1xuaW1wb3J0IHsgS2V5U3RhY2ssIFN0YXR1cywgU1RBVFVTX1RFWFQgfSBmcm9tIFwiLi9kZXBzLnRzXCI7XG5pbXBvcnQgeyBIdHRwU2VydmVyIH0gZnJvbSBcIi4vaHR0cF9zZXJ2ZXJfbmF0aXZlLnRzXCI7XG5pbXBvcnQgeyBOYXRpdmVSZXF1ZXN0IH0gZnJvbSBcIi4vaHR0cF9zZXJ2ZXJfbmF0aXZlX3JlcXVlc3QudHNcIjtcbmltcG9ydCB7XG4gIGNvbXBvc2UsXG4gIGlzTWlkZGxld2FyZU9iamVjdCxcbiAgdHlwZSBNaWRkbGV3YXJlT3JNaWRkbGV3YXJlT2JqZWN0LFxufSBmcm9tIFwiLi9taWRkbGV3YXJlLnRzXCI7XG5pbXBvcnQgeyBjbG9uZVN0YXRlIH0gZnJvbSBcIi4vc3RydWN0dXJlZF9jbG9uZS50c1wiO1xuaW1wb3J0IHtcbiAgS2V5LFxuICBMaXN0ZW5lcixcbiAgU2VydmVyLFxuICBTZXJ2ZXJDb25zdHJ1Y3RvcixcbiAgU2VydmVyUmVxdWVzdCxcbn0gZnJvbSBcIi4vdHlwZXMuZC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0LCBpc0Nvbm4gfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlzdGVuT3B0aW9uc0Jhc2Uge1xuICAvKiogVGhlIHBvcnQgdG8gbGlzdGVuIG9uLiBJZiBub3Qgc3BlY2lmaWVkLCBkZWZhdWx0cyB0byBgMGAsIHdoaWNoIGFsbG93cyB0aGVcbiAgICogb3BlcmF0aW5nIHN5c3RlbSB0byBkZXRlcm1pbmUgdGhlIHZhbHVlLiAqL1xuICBwb3J0PzogbnVtYmVyO1xuICAvKiogQSBsaXRlcmFsIElQIGFkZHJlc3Mgb3IgaG9zdCBuYW1lIHRoYXQgY2FuIGJlIHJlc29sdmVkIHRvIGFuIElQIGFkZHJlc3MuXG4gICAqIElmIG5vdCBzcGVjaWZpZWQsIGRlZmF1bHRzIHRvIGAwLjAuMC4wYC5cbiAgICpcbiAgICogX19Ob3RlIGFib3V0IGAwLjAuMC4wYF9fIFdoaWxlIGxpc3RlbmluZyBgMC4wLjAuMGAgd29ya3Mgb24gYWxsIHBsYXRmb3JtcyxcbiAgICogdGhlIGJyb3dzZXJzIG9uIFdpbmRvd3MgZG9uJ3Qgd29yayB3aXRoIHRoZSBhZGRyZXNzIGAwLjAuMC4wYC5cbiAgICogWW91IHNob3VsZCBzaG93IHRoZSBtZXNzYWdlIGxpa2UgYHNlcnZlciBydW5uaW5nIG9uIGxvY2FsaG9zdDo4MDgwYCBpbnN0ZWFkIG9mXG4gICAqIGBzZXJ2ZXIgcnVubmluZyBvbiAwLjAuMC4wOjgwODBgIGlmIHlvdXIgcHJvZ3JhbSBzdXBwb3J0cyBXaW5kb3dzLiAqL1xuICBob3N0bmFtZT86IHN0cmluZztcbiAgc2VjdXJlPzogZmFsc2U7XG4gIC8qKiBBbiBvcHRpb25hbCBhYm9ydCBzaWduYWwgd2hpY2ggY2FuIGJlIHVzZWQgdG8gY2xvc2UgdGhlIGxpc3RlbmVyLiAqL1xuICBzaWduYWw/OiBBYm9ydFNpZ25hbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMaXN0ZW5PcHRpb25zVGxzIGV4dGVuZHMgRGVuby5MaXN0ZW5UbHNPcHRpb25zIHtcbiAgLyoqIEFwcGxpY2F0aW9uLUxheWVyIFByb3RvY29sIE5lZ290aWF0aW9uIChBTFBOKSBwcm90b2NvbHMgdG8gYW5ub3VuY2UgdG9cbiAgICogdGhlIGNsaWVudC4gSWYgbm90IHNwZWNpZmllZCwgbm8gQUxQTiBleHRlbnNpb24gd2lsbCBiZSBpbmNsdWRlZCBpbiB0aGVcbiAgICogVExTIGhhbmRzaGFrZS5cbiAgICpcbiAgICogKipOT1RFKiogdGhpcyBpcyBwYXJ0IG9mIHRoZSBuYXRpdmUgSFRUUCBzZXJ2ZXIgaW4gRGVubyAxLjkgb3IgbGF0ZXIsXG4gICAqIHdoaWNoIHJlcXVpcmVzIHRoZSBgLS11bnN0YWJsZWAgZmxhZyB0byBiZSBhdmFpbGFibGUuXG4gICAqL1xuICBhbHBuUHJvdG9jb2xzPzogc3RyaW5nW107XG4gIHNlY3VyZTogdHJ1ZTtcbiAgLyoqIEFuIG9wdGlvbmFsIGFib3J0IHNpZ25hbCB3aGljaCBjYW4gYmUgdXNlZCB0byBjbG9zZSB0aGUgbGlzdGVuZXIuICovXG4gIHNpZ25hbD86IEFib3J0U2lnbmFsO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhhbmRsZU1ldGhvZCB7XG4gIC8qKiBIYW5kbGUgYW4gaW5kaXZpZHVhbCBzZXJ2ZXIgcmVxdWVzdCwgcmV0dXJuaW5nIHRoZSBzZXJ2ZXIgcmVzcG9uc2UuICBUaGlzXG4gICAqIGlzIHNpbWlsYXIgdG8gYC5saXN0ZW4oKWAsIGJ1dCBvcGVuaW5nIHRoZSBjb25uZWN0aW9uIGFuZCByZXRyaWV2aW5nXG4gICAqIHJlcXVlc3RzIGFyZSBub3QgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBhcHBsaWNhdGlvbi4gIElmIHRoZSBnZW5lcmF0ZWRcbiAgICogY29udGV4dCBnZXRzIHNldCB0byBub3QgdG8gcmVzcG9uZCwgdGhlbiB0aGUgbWV0aG9kIHJlc29sdmVzIHdpdGhcbiAgICogYHVuZGVmaW5lZGAsIG90aGVyd2lzZSBpdCByZXNvbHZlcyB3aXRoIGEgRE9NIGBSZXNwb25zZWAgb2JqZWN0LiAqL1xuICAoXG4gICAgcmVxdWVzdDogUmVxdWVzdCxcbiAgICBjb25uPzogRGVuby5Db25uLFxuICAgIHNlY3VyZT86IGJvb2xlYW4sXG4gICk6IFByb21pc2U8UmVzcG9uc2UgfCB1bmRlZmluZWQ+O1xufVxuXG5leHBvcnQgdHlwZSBMaXN0ZW5PcHRpb25zID0gTGlzdGVuT3B0aW9uc1RscyB8IExpc3Rlbk9wdGlvbnNCYXNlO1xuXG5pbnRlcmZhY2UgQXBwbGljYXRpb25DbG9zZUV2ZW50TGlzdGVuZXIge1xuICAoZXZ0OiBBcHBsaWNhdGlvbkNsb3NlRXZlbnQpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIEFwcGxpY2F0aW9uQ2xvc2VFdmVudExpc3RlbmVyT2JqZWN0IHtcbiAgaGFuZGxlRXZlbnQoZXZ0OiBBcHBsaWNhdGlvbkNsb3NlRXZlbnQpOiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbn1cblxudHlwZSBBcHBsaWNhdGlvbkNsb3NlRXZlbnRMaXN0ZW5lck9yRXZlbnRMaXN0ZW5lck9iamVjdCA9XG4gIHwgQXBwbGljYXRpb25DbG9zZUV2ZW50TGlzdGVuZXJcbiAgfCBBcHBsaWNhdGlvbkNsb3NlRXZlbnRMaXN0ZW5lck9iamVjdDtcblxuaW50ZXJmYWNlIEFwcGxpY2F0aW9uRXJyb3JFdmVudExpc3RlbmVyPFMgZXh0ZW5kcyBBUywgQVMgZXh0ZW5kcyBTdGF0ZT4ge1xuICAoZXZ0OiBBcHBsaWNhdGlvbkVycm9yRXZlbnQ8UywgQVM+KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG59XG5cbmludGVyZmFjZSBBcHBsaWNhdGlvbkVycm9yRXZlbnRMaXN0ZW5lck9iamVjdDxTIGV4dGVuZHMgQVMsIEFTIGV4dGVuZHMgU3RhdGU+IHtcbiAgaGFuZGxlRXZlbnQoZXZ0OiBBcHBsaWNhdGlvbkVycm9yRXZlbnQ8UywgQVM+KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG59XG5cbmludGVyZmFjZSBBcHBsaWNhdGlvbkVycm9yRXZlbnRJbml0PFMgZXh0ZW5kcyBBUywgQVMgZXh0ZW5kcyBTdGF0ZT5cbiAgZXh0ZW5kcyBFcnJvckV2ZW50SW5pdCB7XG4gIGNvbnRleHQ/OiBDb250ZXh0PFMsIEFTPjtcbn1cblxudHlwZSBBcHBsaWNhdGlvbkVycm9yRXZlbnRMaXN0ZW5lck9yRXZlbnRMaXN0ZW5lck9iamVjdDxcbiAgUyBleHRlbmRzIEFTLFxuICBBUyBleHRlbmRzIFN0YXRlLFxuPiA9XG4gIHwgQXBwbGljYXRpb25FcnJvckV2ZW50TGlzdGVuZXI8UywgQVM+XG4gIHwgQXBwbGljYXRpb25FcnJvckV2ZW50TGlzdGVuZXJPYmplY3Q8UywgQVM+O1xuXG5pbnRlcmZhY2UgQXBwbGljYXRpb25MaXN0ZW5FdmVudExpc3RlbmVyIHtcbiAgKGV2dDogQXBwbGljYXRpb25MaXN0ZW5FdmVudCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xufVxuXG5pbnRlcmZhY2UgQXBwbGljYXRpb25MaXN0ZW5FdmVudExpc3RlbmVyT2JqZWN0IHtcbiAgaGFuZGxlRXZlbnQoZXZ0OiBBcHBsaWNhdGlvbkxpc3RlbkV2ZW50KTogdm9pZCB8IFByb21pc2U8dm9pZD47XG59XG5cbmludGVyZmFjZSBBcHBsaWNhdGlvbkxpc3RlbkV2ZW50SW5pdCBleHRlbmRzIEV2ZW50SW5pdCB7XG4gIGhvc3RuYW1lOiBzdHJpbmc7XG4gIGxpc3RlbmVyOiBMaXN0ZW5lcjtcbiAgcG9ydDogbnVtYmVyO1xuICBzZWN1cmU6IGJvb2xlYW47XG4gIHNlcnZlclR5cGU6IFwibmF0aXZlXCIgfCBcImN1c3RvbVwiO1xufVxuXG50eXBlIEFwcGxpY2F0aW9uTGlzdGVuRXZlbnRMaXN0ZW5lck9yRXZlbnRMaXN0ZW5lck9iamVjdCA9XG4gIHwgQXBwbGljYXRpb25MaXN0ZW5FdmVudExpc3RlbmVyXG4gIHwgQXBwbGljYXRpb25MaXN0ZW5FdmVudExpc3RlbmVyT2JqZWN0O1xuXG4vKiogQXZhaWxhYmxlIG9wdGlvbnMgdGhhdCBhcmUgdXNlZCB3aGVuIGNyZWF0aW5nIGEgbmV3IGluc3RhbmNlIG9mXG4gKiB7QGxpbmtjb2RlIEFwcGxpY2F0aW9ufS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbGljYXRpb25PcHRpb25zPFMgZXh0ZW5kcyBTdGF0ZSwgUiBleHRlbmRzIFNlcnZlclJlcXVlc3Q+IHtcbiAgLyoqIERldGVybWluZSBob3cgd2hlbiBjcmVhdGluZyBhIG5ldyBjb250ZXh0LCB0aGUgc3RhdGUgZnJvbSB0aGUgYXBwbGljYXRpb25cbiAgICogc2hvdWxkIGJlIGFwcGxpZWQuIEEgdmFsdWUgb2YgYFwiY2xvbmVcImAgd2lsbCBzZXQgdGhlIHN0YXRlIGFzIGEgY2xvbmUgb2ZcbiAgICogdGhlIGFwcCBzdGF0ZS4gQW55IG5vbi1jbG9uZWFibGUgb3Igbm9uLWVudW1lcmFibGUgcHJvcGVydGllcyB3aWxsIG5vdCBiZVxuICAgKiBjb3BpZWQuIEEgdmFsdWUgb2YgYFwicHJvdG90eXBlXCJgIG1lYW5zIHRoYXQgdGhlIGFwcGxpY2F0aW9uJ3Mgc3RhdGUgd2lsbCBiZVxuICAgKiB1c2VkIGFzIHRoZSBwcm90b3R5cGUgb2YgdGhlIHRoZSBjb250ZXh0J3Mgc3RhdGUsIG1lYW5pbmcgc2hhbGxvd1xuICAgKiBwcm9wZXJ0aWVzIG9uIHRoZSBjb250ZXh0J3Mgc3RhdGUgd2lsbCBub3QgYmUgcmVmbGVjdGVkIGluIHRoZVxuICAgKiBhcHBsaWNhdGlvbidzIHN0YXRlLiBBIHZhbHVlIG9mIGBcImFsaWFzXCJgIG1lYW5zIHRoYXQgYXBwbGljYXRpb24ncyBgLnN0YXRlYFxuICAgKiBhbmQgdGhlIGNvbnRleHQncyBgLnN0YXRlYCB3aWxsIGJlIGEgcmVmZXJlbmNlIHRvIHRoZSBzYW1lIG9iamVjdC4gQSB2YWx1ZVxuICAgKiBvZiBgXCJlbXB0eVwiYCB3aWxsIGluaXRpYWxpemUgdGhlIGNvbnRleHQncyBgLnN0YXRlYCB3aXRoIGFuIGVtcHR5IG9iamVjdC5cbiAgICpcbiAgICogVGhlIGRlZmF1bHQgdmFsdWUgaXMgYFwiY2xvbmVcImAuXG4gICAqL1xuICBjb250ZXh0U3RhdGU/OiBcImNsb25lXCIgfCBcInByb3RvdHlwZVwiIHwgXCJhbGlhc1wiIHwgXCJlbXB0eVwiO1xuXG4gIC8qKiBBbiBvcHRpb25hbCByZXBsYWNlciBmdW5jdGlvbiB0byBiZSB1c2VkIHdoZW4gc2VyaWFsaXppbmcgYSBKU09OXG4gICAqIHJlc3BvbnNlLiBUaGUgcmVwbGFjZXIgd2lsbCBiZSB1c2VkIHdpdGggYEpTT04uc3RyaW5naWZ5KClgIHRvIGVuY29kZSBhbnlcbiAgICogcmVzcG9uc2UgYm9kaWVzIHRoYXQgbmVlZCB0byBiZSBjb252ZXJ0ZWQgYmVmb3JlIHNlbmRpbmcgdGhlIHJlc3BvbnNlLlxuICAgKlxuICAgKiBUaGlzIGlzIGludGVuZGVkIHRvIGFsbG93IHJlc3BvbnNlcyB0byBjb250YWluIGJpZ2ludHMgYW5kIGNpcmN1bGFyXG4gICAqIHJlZmVyZW5jZXMgYW5kIGVuY29kaW5nIG90aGVyIHZhbHVlcyB3aGljaCBKU09OIGRvZXMgbm90IHN1cHBvcnQgZGlyZWN0bHkuXG4gICAqXG4gICAqIFRoaXMgY2FuIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBganNvbkJvZHlSZXZpdmVyYCB0byBoYW5kbGUgZGVjb2RpbmdcbiAgICogb2YgcmVxdWVzdCBib2RpZXMgaWYgdGhlIHNhbWUgc2VtYW50aWNzIGFyZSB1c2VkIGZvciBjbGllbnQgcmVxdWVzdHMuXG4gICAqXG4gICAqIElmIG1vcmUgZGV0YWlsZWQgb3IgY29uZGl0aW9uYWwgdXNhZ2UgaXMgcmVxdWlyZWQsIHRoZW4gc2VyaWFsaXphdGlvblxuICAgKiBzaG91bGQgYmUgaW1wbGVtZW50ZWQgZGlyZWN0bHkgaW4gbWlkZGxld2FyZS4gKi9cbiAganNvbkJvZHlSZXBsYWNlcj86IChcbiAgICBrZXk6IHN0cmluZyxcbiAgICB2YWx1ZTogdW5rbm93bixcbiAgICBjb250ZXh0OiBDb250ZXh0PFM+LFxuICApID0+IHVua25vd247XG5cbiAgLyoqIEFuIG9wdGlvbmFsIHJldml2ZXIgZnVuY3Rpb24gdG8gYmUgdXNlZCB3aGVuIHBhcnNpbmcgYSBKU09OIHJlcXVlc3QuIFRoZVxuICAgKiByZXZpdmVyIHdpbGwgYmUgdXNlZCB3aXRoIGBKU09OLnBhcnNlKClgIHRvIGRlY29kZSBhbnkgcmVzcG9uc2UgYm9kaWVzIHRoYXRcbiAgICogYXJlIGJlaW5nIGNvbnZlcnRlZCBhcyBKU09OLlxuICAgKlxuICAgKiBUaGlzIGlzIGludGVuZGVkIHRvIGFsbG93IHJlcXVlc3RzIHRvIGRlc2VyaWFsaXplIHRvIGJpZ2ludHMsIGNpcmN1bGFyXG4gICAqIHJlZmVyZW5jZXMsIG9yIG90aGVyIHZhbHVlcyB3aGljaCBKU09OIGRvZXMgbm90IHN1cHBvcnQgZGlyZWN0bHkuXG4gICAqXG4gICAqIFRoaXMgY2FuIGJlIHVzZWQgaW4gY29uanVuY3Rpb24gd2l0aCBganNvbkJvZHlSZXBsYWNlcmAgdG8gaGFuZGxlIGRlY29kaW5nXG4gICAqIG9mIHJlc3BvbnNlIGJvZGllcyBpZiB0aGUgc2FtZSBzZW1hbnRpY3MgYXJlIHVzZWQgZm9yIHJlc3BvbnNlcy5cbiAgICpcbiAgICogSWYgbW9yZSBkZXRhaWxlZCBvciBjb25kaXRpb25hbCB1c2FnZSBpcyByZXF1aXJlZCwgdGhlbiBkZXNlcmlhbGl6YXRpb25cbiAgICogc2hvdWxkIGJlIGltcGxlbWVudGVkIGRpcmVjdGx5IGluIHRoZSBtaWRkbGV3YXJlLlxuICAgKi9cbiAganNvbkJvZHlSZXZpdmVyPzogKFxuICAgIGtleTogc3RyaW5nLFxuICAgIHZhbHVlOiB1bmtub3duLFxuICAgIGNvbnRleHQ6IENvbnRleHQ8Uz4sXG4gICkgPT4gdW5rbm93bjtcblxuICAvKiogQW4gaW5pdGlhbCBzZXQgb2Yga2V5cyAob3IgaW5zdGFuY2Ugb2Yge0BsaW5rY29kZSBLZXlTdGFja30pIHRvIGJlIHVzZWQgZm9yIHNpZ25pbmdcbiAgICogY29va2llcyBwcm9kdWNlZCBieSB0aGUgYXBwbGljYXRpb24uICovXG4gIGtleXM/OiBLZXlTdGFjayB8IEtleVtdO1xuXG4gIC8qKiBJZiBgdHJ1ZWAsIGFueSBlcnJvcnMgaGFuZGxlZCBieSB0aGUgYXBwbGljYXRpb24gd2lsbCBiZSBsb2dnZWQgdG8gdGhlXG4gICAqIHN0ZGVyci4gSWYgYGZhbHNlYCBub3RoaW5nIHdpbGwgYmUgbG9nZ2VkLiBUaGUgZGVmYXVsdCBpcyBgdHJ1ZWAuXG4gICAqXG4gICAqIEFsbCBlcnJvcnMgYXJlIGF2YWlsYWJsZSBhcyBldmVudHMgb24gdGhlIGFwcGxpY2F0aW9uIG9mIHR5cGUgYFwiZXJyb3JcImAgYW5kXG4gICAqIGNhbiBiZSBhY2Nlc3NlZCBmb3IgY3VzdG9tIGxvZ2dpbmcvYXBwbGljYXRpb24gbWFuYWdlbWVudCB2aWEgYWRkaW5nIGFuXG4gICAqIGV2ZW50IGxpc3RlbmVyIHRvIHRoZSBhcHBsaWNhdGlvbjpcbiAgICpcbiAgICogYGBgdHNcbiAgICogY29uc3QgYXBwID0gbmV3IEFwcGxpY2F0aW9uKHsgbG9nRXJyb3JzOiBmYWxzZSB9KTtcbiAgICogYXBwLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoZXZ0KSA9PiB7XG4gICAqICAgLy8gZXZ0LmVycm9yIHdpbGwgY29udGFpbiB3aGF0IGVycm9yIHdhcyB0aHJvd25cbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgbG9nRXJyb3JzPzogYm9vbGVhbjtcblxuICAvKiogSWYgc2V0IHRvIGB0cnVlYCwgcHJveHkgaGVhZGVycyB3aWxsIGJlIHRydXN0ZWQgd2hlbiBwcm9jZXNzaW5nIHJlcXVlc3RzLlxuICAgKiBUaGlzIGRlZmF1bHRzIHRvIGBmYWxzZWAuICovXG4gIHByb3h5PzogYm9vbGVhbjtcblxuICAvKiogQSBzZXJ2ZXIgY29uc3RydWN0b3IgdG8gdXNlIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgc2VydmVyIGZvciByZWNlaXZpbmdcbiAgICogcmVxdWVzdHMuXG4gICAqXG4gICAqIEdlbmVyYWxseSB0aGlzIGlzIG9ubHkgdXNlZCBmb3IgdGVzdGluZy4gKi9cbiAgc2VydmVyQ29uc3RydWN0b3I/OiBTZXJ2ZXJDb25zdHJ1Y3RvcjxSPjtcblxuICAvKiogVGhlIGluaXRpYWwgc3RhdGUgb2JqZWN0IGZvciB0aGUgYXBwbGljYXRpb24sIG9mIHdoaWNoIHRoZSB0eXBlIGNhbiBiZVxuICAgKiB1c2VkIHRvIGluZmVyIHRoZSB0eXBlIG9mIHRoZSBzdGF0ZSBmb3IgYm90aCB0aGUgYXBwbGljYXRpb24gYW5kIGFueSBvZiB0aGVcbiAgICogYXBwbGljYXRpb24ncyBjb250ZXh0LiAqL1xuICBzdGF0ZT86IFM7XG59XG5cbmludGVyZmFjZSBSZXF1ZXN0U3RhdGUge1xuICBoYW5kbGluZzogU2V0PFByb21pc2U8dm9pZD4+O1xuICBjbG9zaW5nOiBib29sZWFuO1xuICBjbG9zZWQ6IGJvb2xlYW47XG4gIHNlcnZlcjogU2VydmVyPFNlcnZlclJlcXVlc3Q+O1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IHR5cGUgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nIHwgbnVtYmVyIHwgc3ltYm9sLCBhbnk+O1xuXG5jb25zdCBBRERSX1JFR0VYUCA9IC9eXFxbPyhbXlxcXV0qKVxcXT86KFswLTldezEsNX0pJC87XG5cbmNvbnN0IERFRkFVTFRfU0VSVkVSOiBTZXJ2ZXJDb25zdHJ1Y3RvcjxTZXJ2ZXJSZXF1ZXN0PiA9IEh0dHBTZXJ2ZXI7XG5cbmV4cG9ydCBjbGFzcyBBcHBsaWNhdGlvbkNsb3NlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKGV2ZW50SW5pdERpY3Q6IEV2ZW50SW5pdCkge1xuICAgIHN1cGVyKFwiY2xvc2VcIiwgZXZlbnRJbml0RGljdCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEFwcGxpY2F0aW9uRXJyb3JFdmVudDxTIGV4dGVuZHMgQVMsIEFTIGV4dGVuZHMgU3RhdGU+XG4gIGV4dGVuZHMgRXJyb3JFdmVudCB7XG4gIGNvbnRleHQ/OiBDb250ZXh0PFMsIEFTPjtcblxuICBjb25zdHJ1Y3RvcihldmVudEluaXREaWN0OiBBcHBsaWNhdGlvbkVycm9yRXZlbnRJbml0PFMsIEFTPikge1xuICAgIHN1cGVyKFwiZXJyb3JcIiwgZXZlbnRJbml0RGljdCk7XG4gICAgdGhpcy5jb250ZXh0ID0gZXZlbnRJbml0RGljdC5jb250ZXh0O1xuICB9XG59XG5cbmZ1bmN0aW9uIGxvZ0Vycm9yTGlzdGVuZXI8UyBleHRlbmRzIEFTLCBBUyBleHRlbmRzIFN0YXRlPihcbiAgeyBlcnJvciwgY29udGV4dCB9OiBBcHBsaWNhdGlvbkVycm9yRXZlbnQ8UywgQVM+LFxuKSB7XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcbiAgICAgIGBbdW5jYXVnaHQgYXBwbGljYXRpb24gZXJyb3JdOiAke2Vycm9yLm5hbWV9IC0gJHtlcnJvci5tZXNzYWdlfWAsXG4gICAgKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLmVycm9yKGBbdW5jYXVnaHQgYXBwbGljYXRpb24gZXJyb3JdXFxuYCwgZXJyb3IpO1xuICB9XG4gIGlmIChjb250ZXh0KSB7XG4gICAgbGV0IHVybDogc3RyaW5nO1xuICAgIHRyeSB7XG4gICAgICB1cmwgPSBjb250ZXh0LnJlcXVlc3QudXJsLnRvU3RyaW5nKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICB1cmwgPSBcIlttYWxmb3JtZWQgdXJsXVwiO1xuICAgIH1cbiAgICBjb25zb2xlLmVycm9yKGBcXG5yZXF1ZXN0OmAsIHtcbiAgICAgIHVybCxcbiAgICAgIG1ldGhvZDogY29udGV4dC5yZXF1ZXN0Lm1ldGhvZCxcbiAgICAgIGhhc0JvZHk6IGNvbnRleHQucmVxdWVzdC5oYXNCb2R5LFxuICAgIH0pO1xuICAgIGNvbnNvbGUuZXJyb3IoYHJlc3BvbnNlOmAsIHtcbiAgICAgIHN0YXR1czogY29udGV4dC5yZXNwb25zZS5zdGF0dXMsXG4gICAgICB0eXBlOiBjb250ZXh0LnJlc3BvbnNlLnR5cGUsXG4gICAgICBoYXNCb2R5OiAhIWNvbnRleHQucmVzcG9uc2UuYm9keSxcbiAgICAgIHdyaXRhYmxlOiBjb250ZXh0LnJlc3BvbnNlLndyaXRhYmxlLFxuICAgIH0pO1xuICB9XG4gIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yICYmIGVycm9yLnN0YWNrKSB7XG4gICAgY29uc29sZS5lcnJvcihgXFxuJHtlcnJvci5zdGFjay5zcGxpdChcIlxcblwiKS5zbGljZSgxKS5qb2luKFwiXFxuXCIpfWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBBcHBsaWNhdGlvbkxpc3RlbkV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBob3N0bmFtZTogc3RyaW5nO1xuICBsaXN0ZW5lcjogTGlzdGVuZXI7XG4gIHBvcnQ6IG51bWJlcjtcbiAgc2VjdXJlOiBib29sZWFuO1xuICBzZXJ2ZXJUeXBlOiBcIm5hdGl2ZVwiIHwgXCJjdXN0b21cIjtcblxuICBjb25zdHJ1Y3RvcihldmVudEluaXREaWN0OiBBcHBsaWNhdGlvbkxpc3RlbkV2ZW50SW5pdCkge1xuICAgIHN1cGVyKFwibGlzdGVuXCIsIGV2ZW50SW5pdERpY3QpO1xuICAgIHRoaXMuaG9zdG5hbWUgPSBldmVudEluaXREaWN0Lmhvc3RuYW1lO1xuICAgIHRoaXMubGlzdGVuZXIgPSBldmVudEluaXREaWN0Lmxpc3RlbmVyO1xuICAgIHRoaXMucG9ydCA9IGV2ZW50SW5pdERpY3QucG9ydDtcbiAgICB0aGlzLnNlY3VyZSA9IGV2ZW50SW5pdERpY3Quc2VjdXJlO1xuICAgIHRoaXMuc2VydmVyVHlwZSA9IGV2ZW50SW5pdERpY3Quc2VydmVyVHlwZTtcbiAgfVxufVxuXG4vKiogQSBjbGFzcyB3aGljaCByZWdpc3RlcnMgbWlkZGxld2FyZSAodmlhIGAudXNlKClgKSBhbmQgdGhlbiBwcm9jZXNzZXNcbiAqIGluYm91bmQgcmVxdWVzdHMgYWdhaW5zdCB0aGF0IG1pZGRsZXdhcmUgKHZpYSBgLmxpc3RlbigpYCkuXG4gKlxuICogVGhlIGBjb250ZXh0LnN0YXRlYCBjYW4gYmUgdHlwZWQgdmlhIHBhc3NpbmcgYSBnZW5lcmljIGFyZ3VtZW50IHdoZW5cbiAqIGNvbnN0cnVjdGluZyBhbiBpbnN0YW5jZSBvZiBgQXBwbGljYXRpb25gLiBJdCBjYW4gYWxzbyBiZSBpbmZlcnJlZCBieSBzZXR0aW5nXG4gKiB0aGUge0BsaW5rY29kZSBBcHBsaWNhdGlvbk9wdGlvbnMuc3RhdGV9IG9wdGlvbiB3aGVuIGNvbnN0cnVjdGluZyB0aGVcbiAqIGFwcGxpY2F0aW9uLlxuICpcbiAqICMjIyBCYXNpYyBleGFtcGxlXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IEFwcGxpY2F0aW9uIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrL21vZC50c1wiO1xuICpcbiAqIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbigpO1xuICpcbiAqIGFwcC51c2UoKGN0eCwgbmV4dCkgPT4ge1xuICogICAvLyBjYWxsZWQgb24gZWFjaCByZXF1ZXN0IHdpdGggdGhlIGNvbnRleHQgKGBjdHhgKSBvZiB0aGUgcmVxdWVzdCxcbiAqICAgLy8gcmVzcG9uc2UsIGFuZCBvdGhlciBkYXRhLlxuICogICAvLyBgbmV4dCgpYCBpcyB1c2UgdG8gbW9kaWZ5IHRoZSBmbG93IGNvbnRyb2wgb2YgdGhlIG1pZGRsZXdhcmUgc3RhY2suXG4gKiB9KTtcbiAqXG4gKiBhcHAubGlzdGVuKHsgcG9ydDogODA4MCB9KTtcbiAqIGBgYFxuICpcbiAqIEB0ZW1wbGF0ZSBBUyB0aGUgdHlwZSBvZiB0aGUgYXBwbGljYXRpb24gc3RhdGUgd2hpY2ggZXh0ZW5kc1xuICogICAgICAgICAgICAgIHtAbGlua2NvZGUgU3RhdGV9IGFuZCBkZWZhdWx0cyB0byBhIHNpbXBsZSBzdHJpbmcgcmVjb3JkLlxuICovXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IGNsYXNzIEFwcGxpY2F0aW9uPEFTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+PlxuICBleHRlbmRzIEV2ZW50VGFyZ2V0IHtcbiAgI2NvbXBvc2VkTWlkZGxld2FyZT86IChjb250ZXh0OiBDb250ZXh0PEFTLCBBUz4pID0+IFByb21pc2U8dW5rbm93bj47XG4gICNjb250ZXh0T3B0aW9uczogUGljazxcbiAgICBBcHBsaWNhdGlvbk9wdGlvbnM8QVMsIFNlcnZlclJlcXVlc3Q+LFxuICAgIFwianNvbkJvZHlSZXBsYWNlclwiIHwgXCJqc29uQm9keVJldml2ZXJcIlxuICA+O1xuICAjY29udGV4dFN0YXRlOiBcImNsb25lXCIgfCBcInByb3RvdHlwZVwiIHwgXCJhbGlhc1wiIHwgXCJlbXB0eVwiO1xuICAja2V5cz86IEtleVN0YWNrO1xuICAjbWlkZGxld2FyZTogTWlkZGxld2FyZU9yTWlkZGxld2FyZU9iamVjdDxTdGF0ZSwgQ29udGV4dDxTdGF0ZSwgQVM+PltdID0gW107XG4gICNzZXJ2ZXJDb25zdHJ1Y3RvcjogU2VydmVyQ29uc3RydWN0b3I8U2VydmVyUmVxdWVzdD47XG5cbiAgLyoqIEEgc2V0IG9mIGtleXMsIG9yIGFuIGluc3RhbmNlIG9mIGBLZXlTdGFja2Agd2hpY2ggd2lsbCBiZSB1c2VkIHRvIHNpZ25cbiAgICogY29va2llcyByZWFkIGFuZCBzZXQgYnkgdGhlIGFwcGxpY2F0aW9uIHRvIGF2b2lkIHRhbXBlcmluZyB3aXRoIHRoZVxuICAgKiBjb29raWVzLiAqL1xuICBnZXQga2V5cygpOiBLZXlTdGFjayB8IEtleVtdIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy4ja2V5cztcbiAgfVxuXG4gIHNldCBrZXlzKGtleXM6IEtleVN0YWNrIHwgS2V5W10gfCB1bmRlZmluZWQpIHtcbiAgICBpZiAoIWtleXMpIHtcbiAgICAgIHRoaXMuI2tleXMgPSB1bmRlZmluZWQ7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGtleXMpKSB7XG4gICAgICB0aGlzLiNrZXlzID0gbmV3IEtleVN0YWNrKGtleXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNrZXlzID0ga2V5cztcbiAgICB9XG4gIH1cblxuICAvKiogSWYgYHRydWVgLCBwcm94eSBoZWFkZXJzIHdpbGwgYmUgdHJ1c3RlZCB3aGVuIHByb2Nlc3NpbmcgcmVxdWVzdHMuICBUaGlzXG4gICAqIGRlZmF1bHRzIHRvIGBmYWxzZWAuICovXG4gIHByb3h5OiBib29sZWFuO1xuXG4gIC8qKiBHZW5lcmljIHN0YXRlIG9mIHRoZSBhcHBsaWNhdGlvbiwgd2hpY2ggY2FuIGJlIHNwZWNpZmllZCBieSBwYXNzaW5nIHRoZVxuICAgKiBnZW5lcmljIGFyZ3VtZW50IHdoZW4gY29uc3RydWN0aW5nOlxuICAgKlxuICAgKiAgICAgICBjb25zdCBhcHAgPSBuZXcgQXBwbGljYXRpb248eyBmb286IHN0cmluZyB9PigpO1xuICAgKlxuICAgKiBPciBjYW4gYmUgY29udGV4dHVhbGx5IGluZmVycmVkIGJhc2VkIG9uIHNldHRpbmcgYW4gaW5pdGlhbCBzdGF0ZSBvYmplY3Q6XG4gICAqXG4gICAqICAgICAgIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbih7IHN0YXRlOiB7IGZvbzogXCJiYXJcIiB9IH0pO1xuICAgKlxuICAgKiBXaGVuIGEgbmV3IGNvbnRleHQgaXMgY3JlYXRlZCwgdGhlIGFwcGxpY2F0aW9uJ3Mgc3RhdGUgaXMgY2xvbmVkIGFuZCB0aGVcbiAgICogc3RhdGUgaXMgdW5pcXVlIHRvIHRoYXQgcmVxdWVzdC9yZXNwb25zZS4gIENoYW5nZXMgY2FuIGJlIG1hZGUgdG8gdGhlXG4gICAqIGFwcGxpY2F0aW9uIHN0YXRlIHRoYXQgd2lsbCBiZSBzaGFyZWQgd2l0aCBhbGwgY29udGV4dHMuXG4gICAqL1xuICBzdGF0ZTogQVM7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9uczogQXBwbGljYXRpb25PcHRpb25zPEFTLCBTZXJ2ZXJSZXF1ZXN0PiA9IHt9KSB7XG4gICAgc3VwZXIoKTtcbiAgICBjb25zdCB7XG4gICAgICBzdGF0ZSxcbiAgICAgIGtleXMsXG4gICAgICBwcm94eSxcbiAgICAgIHNlcnZlckNvbnN0cnVjdG9yID0gREVGQVVMVF9TRVJWRVIsXG4gICAgICBjb250ZXh0U3RhdGUgPSBcImNsb25lXCIsXG4gICAgICBsb2dFcnJvcnMgPSB0cnVlLFxuICAgICAgLi4uY29udGV4dE9wdGlvbnNcbiAgICB9ID0gb3B0aW9ucztcblxuICAgIHRoaXMucHJveHkgPSBwcm94eSA/PyBmYWxzZTtcbiAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZSA/PyB7fSBhcyBBUztcbiAgICB0aGlzLiNzZXJ2ZXJDb25zdHJ1Y3RvciA9IHNlcnZlckNvbnN0cnVjdG9yO1xuICAgIHRoaXMuI2NvbnRleHRPcHRpb25zID0gY29udGV4dE9wdGlvbnM7XG4gICAgdGhpcy4jY29udGV4dFN0YXRlID0gY29udGV4dFN0YXRlO1xuXG4gICAgaWYgKGxvZ0Vycm9ycykge1xuICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgbG9nRXJyb3JMaXN0ZW5lcik7XG4gICAgfVxuICB9XG5cbiAgI2dldENvbXBvc2VkKCk6IChjb250ZXh0OiBDb250ZXh0PEFTLCBBUz4pID0+IFByb21pc2U8dW5rbm93bj4ge1xuICAgIGlmICghdGhpcy4jY29tcG9zZWRNaWRkbGV3YXJlKSB7XG4gICAgICB0aGlzLiNjb21wb3NlZE1pZGRsZXdhcmUgPSBjb21wb3NlKHRoaXMuI21pZGRsZXdhcmUpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jY29tcG9zZWRNaWRkbGV3YXJlO1xuICB9XG5cbiAgI2dldENvbnRleHRTdGF0ZSgpOiBBUyB7XG4gICAgc3dpdGNoICh0aGlzLiNjb250ZXh0U3RhdGUpIHtcbiAgICAgIGNhc2UgXCJhbGlhc1wiOlxuICAgICAgICByZXR1cm4gdGhpcy5zdGF0ZTtcbiAgICAgIGNhc2UgXCJjbG9uZVwiOlxuICAgICAgICByZXR1cm4gY2xvbmVTdGF0ZSh0aGlzLnN0YXRlKTtcbiAgICAgIGNhc2UgXCJlbXB0eVwiOlxuICAgICAgICByZXR1cm4ge30gYXMgQVM7XG4gICAgICBjYXNlIFwicHJvdG90eXBlXCI6XG4gICAgICAgIHJldHVybiBPYmplY3QuY3JlYXRlKHRoaXMuc3RhdGUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBEZWFsIHdpdGggdW5jYXVnaHQgZXJyb3JzIGluIGVpdGhlciB0aGUgbWlkZGxld2FyZSBvciBzZW5kaW5nIHRoZVxuICAgKiByZXNwb25zZS4gKi9cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgI2hhbmRsZUVycm9yKGNvbnRleHQ6IENvbnRleHQ8QVM+LCBlcnJvcjogYW55KTogdm9pZCB7XG4gICAgaWYgKCEoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKGBub24tZXJyb3IgdGhyb3duOiAke0pTT04uc3RyaW5naWZ5KGVycm9yKX1gKTtcbiAgICB9XG4gICAgY29uc3QgeyBtZXNzYWdlIH0gPSBlcnJvcjtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEFwcGxpY2F0aW9uRXJyb3JFdmVudCh7IGNvbnRleHQsIG1lc3NhZ2UsIGVycm9yIH0pKTtcbiAgICBpZiAoIWNvbnRleHQucmVzcG9uc2Uud3JpdGFibGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBrZXkgb2YgWy4uLmNvbnRleHQucmVzcG9uc2UuaGVhZGVycy5rZXlzKCldKSB7XG4gICAgICBjb250ZXh0LnJlc3BvbnNlLmhlYWRlcnMuZGVsZXRlKGtleSk7XG4gICAgfVxuICAgIGlmIChlcnJvci5oZWFkZXJzICYmIGVycm9yLmhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBlcnJvci5oZWFkZXJzKSB7XG4gICAgICAgIGNvbnRleHQucmVzcG9uc2UuaGVhZGVycy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnRleHQucmVzcG9uc2UudHlwZSA9IFwidGV4dFwiO1xuICAgIGNvbnN0IHN0YXR1czogU3RhdHVzID0gY29udGV4dC5yZXNwb25zZS5zdGF0dXMgPVxuICAgICAgRGVuby5lcnJvcnMgJiYgZXJyb3IgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RGb3VuZFxuICAgICAgICA/IDQwNFxuICAgICAgICA6IGVycm9yLnN0YXR1cyAmJiB0eXBlb2YgZXJyb3Iuc3RhdHVzID09PSBcIm51bWJlclwiXG4gICAgICAgID8gZXJyb3Iuc3RhdHVzXG4gICAgICAgIDogNTAwO1xuICAgIGNvbnRleHQucmVzcG9uc2UuYm9keSA9IGVycm9yLmV4cG9zZSA/IGVycm9yLm1lc3NhZ2UgOiBTVEFUVVNfVEVYVFtzdGF0dXNdO1xuICB9XG5cbiAgLyoqIFByb2Nlc3NpbmcgcmVnaXN0ZXJlZCBtaWRkbGV3YXJlIG9uIGVhY2ggcmVxdWVzdC4gKi9cbiAgYXN5bmMgI2hhbmRsZVJlcXVlc3QoXG4gICAgcmVxdWVzdDogU2VydmVyUmVxdWVzdCxcbiAgICBzZWN1cmU6IGJvb2xlYW4sXG4gICAgc3RhdGU6IFJlcXVlc3RTdGF0ZSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGNvbnRleHQ6IENvbnRleHQ8QVMsIEFTPiB8IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgY29udGV4dCA9IG5ldyBDb250ZXh0KFxuICAgICAgICB0aGlzLFxuICAgICAgICByZXF1ZXN0LFxuICAgICAgICB0aGlzLiNnZXRDb250ZXh0U3RhdGUoKSxcbiAgICAgICAgeyBzZWN1cmUsIC4uLnRoaXMuI2NvbnRleHRPcHRpb25zIH0sXG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gZSBpbnN0YW5jZW9mIEVycm9yXG4gICAgICAgID8gZVxuICAgICAgICA6IG5ldyBFcnJvcihgbm9uLWVycm9yIHRocm93bjogJHtKU09OLnN0cmluZ2lmeShlKX1gKTtcbiAgICAgIGNvbnN0IHsgbWVzc2FnZSB9ID0gZXJyb3I7XG4gICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IEFwcGxpY2F0aW9uRXJyb3JFdmVudCh7IG1lc3NhZ2UsIGVycm9yIH0pKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYXNzZXJ0KGNvbnRleHQsIFwiQ29udGV4dCB3YXMgbm90IGNyZWF0ZWQuXCIpO1xuICAgIGxldCByZXNvbHZlOiAoKSA9PiB2b2lkO1xuICAgIGNvbnN0IGhhbmRsaW5nUHJvbWlzZSA9IG5ldyBQcm9taXNlPHZvaWQ+KChyZXMpID0+IHJlc29sdmUgPSByZXMpO1xuICAgIHN0YXRlLmhhbmRsaW5nLmFkZChoYW5kbGluZ1Byb21pc2UpO1xuICAgIGlmICghc3RhdGUuY2xvc2luZyAmJiAhc3RhdGUuY2xvc2VkKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLiNnZXRDb21wb3NlZCgpKGNvbnRleHQpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHRoaXMuI2hhbmRsZUVycm9yKGNvbnRleHQsIGVycik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb250ZXh0LnJlc3BvbmQgPT09IGZhbHNlKSB7XG4gICAgICBjb250ZXh0LnJlc3BvbnNlLmRlc3Ryb3koKTtcbiAgICAgIHJlc29sdmUhKCk7XG4gICAgICBzdGF0ZS5oYW5kbGluZy5kZWxldGUoaGFuZGxpbmdQcm9taXNlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IGNsb3NlUmVzb3VyY2VzID0gdHJ1ZTtcbiAgICBsZXQgcmVzcG9uc2U6IFJlc3BvbnNlO1xuICAgIHRyeSB7XG4gICAgICBjbG9zZVJlc291cmNlcyA9IGZhbHNlO1xuICAgICAgcmVzcG9uc2UgPSBhd2FpdCBjb250ZXh0LnJlc3BvbnNlLnRvRG9tUmVzcG9uc2UoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMuI2hhbmRsZUVycm9yKGNvbnRleHQsIGVycik7XG4gICAgICByZXNwb25zZSA9IGF3YWl0IGNvbnRleHQucmVzcG9uc2UudG9Eb21SZXNwb25zZSgpO1xuICAgIH1cbiAgICBhc3NlcnQocmVzcG9uc2UpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCByZXF1ZXN0LnJlc3BvbmQocmVzcG9uc2UpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy4jaGFuZGxlRXJyb3IoY29udGV4dCwgZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgY29udGV4dC5yZXNwb25zZS5kZXN0cm95KGNsb3NlUmVzb3VyY2VzKTtcbiAgICAgIHJlc29sdmUhKCk7XG4gICAgICBzdGF0ZS5oYW5kbGluZy5kZWxldGUoaGFuZGxpbmdQcm9taXNlKTtcbiAgICAgIGlmIChzdGF0ZS5jbG9zaW5nKSB7XG4gICAgICAgIGF3YWl0IHN0YXRlLnNlcnZlci5jbG9zZSgpO1xuICAgICAgICBpZiAoIXN0YXRlLmNsb3NlZCkge1xuICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChuZXcgQXBwbGljYXRpb25DbG9zZUV2ZW50KHt9KSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuY2xvc2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogQWRkIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhIGBcImNsb3NlXCJgIGV2ZW50IHdoaWNoIG9jY3VycyB3aGVuIHRoZVxuICAgKiBhcHBsaWNhdGlvbiBpcyBjbG9zZWQgYW5kIG5vIGxvbmdlciBsaXN0ZW5pbmcgb3IgaGFuZGxpbmcgcmVxdWVzdHMuICovXG4gIGFkZEV2ZW50TGlzdGVuZXI8UyBleHRlbmRzIEFTPihcbiAgICB0eXBlOiBcImNsb3NlXCIsXG4gICAgbGlzdGVuZXI6IEFwcGxpY2F0aW9uQ2xvc2VFdmVudExpc3RlbmVyT3JFdmVudExpc3RlbmVyT2JqZWN0IHwgbnVsbCxcbiAgICBvcHRpb25zPzogYm9vbGVhbiB8IEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zLFxuICApOiB2b2lkO1xuICAvKiogQWRkIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBgXCJlcnJvclwiYCBldmVudCB3aGljaCBvY2N1cnMgd2hlbiBhblxuICAgKiB1bi1jYXVnaHQgZXJyb3Igb2NjdXJzIHdoZW4gcHJvY2Vzc2luZyB0aGUgbWlkZGxld2FyZSBvciBkdXJpbmcgcHJvY2Vzc2luZ1xuICAgKiBvZiB0aGUgcmVzcG9uc2UuICovXG4gIGFkZEV2ZW50TGlzdGVuZXI8UyBleHRlbmRzIEFTPihcbiAgICB0eXBlOiBcImVycm9yXCIsXG4gICAgbGlzdGVuZXI6IEFwcGxpY2F0aW9uRXJyb3JFdmVudExpc3RlbmVyT3JFdmVudExpc3RlbmVyT2JqZWN0PFMsIEFTPiB8IG51bGwsXG4gICAgb3B0aW9ucz86IGJvb2xlYW4gfCBBZGRFdmVudExpc3RlbmVyT3B0aW9ucyxcbiAgKTogdm9pZDtcbiAgLyoqIEFkZCBhbiBldmVudCBsaXN0ZW5lciBmb3IgYSBgXCJsaXN0ZW5cImAgZXZlbnQgd2hpY2ggb2NjdXJzIHdoZW4gdGhlIHNlcnZlclxuICAgKiBoYXMgc3VjY2Vzc2Z1bGx5IG9wZW5lZCBidXQgYmVmb3JlIGFueSByZXF1ZXN0cyBzdGFydCBiZWluZyBwcm9jZXNzZWQuICovXG4gIGFkZEV2ZW50TGlzdGVuZXIoXG4gICAgdHlwZTogXCJsaXN0ZW5cIixcbiAgICBsaXN0ZW5lcjogQXBwbGljYXRpb25MaXN0ZW5FdmVudExpc3RlbmVyT3JFdmVudExpc3RlbmVyT2JqZWN0IHwgbnVsbCxcbiAgICBvcHRpb25zPzogYm9vbGVhbiB8IEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zLFxuICApOiB2b2lkO1xuICAvKiogQWRkIGFuIGV2ZW50IGxpc3RlbmVyIGZvciBhbiBldmVudC4gIEN1cnJlbnRseSB2YWxpZCBldmVudCB0eXBlcyBhcmVcbiAgICogYFwiZXJyb3JcImAgYW5kIGBcImxpc3RlblwiYC4gKi9cbiAgYWRkRXZlbnRMaXN0ZW5lcihcbiAgICB0eXBlOiBcImNsb3NlXCIgfCBcImVycm9yXCIgfCBcImxpc3RlblwiLFxuICAgIGxpc3RlbmVyOiBFdmVudExpc3RlbmVyT3JFdmVudExpc3RlbmVyT2JqZWN0IHwgbnVsbCxcbiAgICBvcHRpb25zPzogYm9vbGVhbiB8IEFkZEV2ZW50TGlzdGVuZXJPcHRpb25zLFxuICApOiB2b2lkIHtcbiAgICBzdXBlci5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKiBIYW5kbGUgYW4gaW5kaXZpZHVhbCBzZXJ2ZXIgcmVxdWVzdCwgcmV0dXJuaW5nIHRoZSBzZXJ2ZXIgcmVzcG9uc2UuICBUaGlzXG4gICAqIGlzIHNpbWlsYXIgdG8gYC5saXN0ZW4oKWAsIGJ1dCBvcGVuaW5nIHRoZSBjb25uZWN0aW9uIGFuZCByZXRyaWV2aW5nXG4gICAqIHJlcXVlc3RzIGFyZSBub3QgdGhlIHJlc3BvbnNpYmlsaXR5IG9mIHRoZSBhcHBsaWNhdGlvbi4gIElmIHRoZSBnZW5lcmF0ZWRcbiAgICogY29udGV4dCBnZXRzIHNldCB0byBub3QgdG8gcmVzcG9uZCwgdGhlbiB0aGUgbWV0aG9kIHJlc29sdmVzIHdpdGhcbiAgICogYHVuZGVmaW5lZGAsIG90aGVyd2lzZSBpdCByZXNvbHZlcyB3aXRoIGEgcmVxdWVzdCB0aGF0IGlzIGNvbXBhdGlibGUgd2l0aFxuICAgKiBgc3RkL2h0dHAvc2VydmVyYC4gKi9cbiAgaGFuZGxlID0gKGFzeW5jIChcbiAgICByZXF1ZXN0OiBSZXF1ZXN0LFxuICAgIHNlY3VyZU9yQ29ubjogRGVuby5Db25uIHwgYm9vbGVhbiB8IHVuZGVmaW5lZCxcbiAgICBzZWN1cmU6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSBmYWxzZSxcbiAgKTogUHJvbWlzZTxSZXNwb25zZSB8IHVuZGVmaW5lZD4gPT4ge1xuICAgIGlmICghdGhpcy4jbWlkZGxld2FyZS5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJUaGVyZSBpcyBubyBtaWRkbGV3YXJlIHRvIHByb2Nlc3MgcmVxdWVzdHMuXCIpO1xuICAgIH1cbiAgICBhc3NlcnQoaXNDb25uKHNlY3VyZU9yQ29ubikgfHwgdHlwZW9mIHNlY3VyZU9yQ29ubiA9PT0gXCJ1bmRlZmluZWRcIik7XG4gICAgY29uc3QgY29udGV4dFJlcXVlc3QgPSBuZXcgTmF0aXZlUmVxdWVzdCh7XG4gICAgICByZXF1ZXN0LFxuICAgICAgcmVzcG9uZFdpdGgoKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgIH0sXG4gICAgfSwgeyBjb25uOiBzZWN1cmVPckNvbm4gfSk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0KFxuICAgICAgdGhpcyxcbiAgICAgIGNvbnRleHRSZXF1ZXN0LFxuICAgICAgdGhpcy4jZ2V0Q29udGV4dFN0YXRlKCksXG4gICAgICB7IHNlY3VyZSwgLi4udGhpcy4jY29udGV4dE9wdGlvbnMgfSxcbiAgICApO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLiNnZXRDb21wb3NlZCgpKGNvbnRleHQpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy4jaGFuZGxlRXJyb3IoY29udGV4dCwgZXJyKTtcbiAgICB9XG4gICAgaWYgKGNvbnRleHQucmVzcG9uZCA9PT0gZmFsc2UpIHtcbiAgICAgIGNvbnRleHQucmVzcG9uc2UuZGVzdHJveSgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb250ZXh0LnJlc3BvbnNlLnRvRG9tUmVzcG9uc2UoKTtcbiAgICAgIGNvbnRleHQucmVzcG9uc2UuZGVzdHJveShmYWxzZSk7XG4gICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aGlzLiNoYW5kbGVFcnJvcihjb250ZXh0LCBlcnIpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfSkgYXMgSGFuZGxlTWV0aG9kO1xuXG4gIC8qKiBTdGFydCBsaXN0ZW5pbmcgZm9yIHJlcXVlc3RzLCBwcm9jZXNzaW5nIHJlZ2lzdGVyZWQgbWlkZGxld2FyZSBvbiBlYWNoXG4gICAqIHJlcXVlc3QuICBJZiB0aGUgb3B0aW9ucyBgLnNlY3VyZWAgaXMgdW5kZWZpbmVkIG9yIGBmYWxzZWAsIHRoZSBsaXN0ZW5pbmdcbiAgICogd2lsbCBiZSBvdmVyIEhUVFAuICBJZiB0aGUgb3B0aW9ucyBgLnNlY3VyZWAgcHJvcGVydHkgaXMgYHRydWVgLCBhXG4gICAqIGAuY2VydEZpbGVgIGFuZCBhIGAua2V5RmlsZWAgcHJvcGVydHkgbmVlZCB0byBiZSBzdXBwbGllZCBhbmQgcmVxdWVzdHNcbiAgICogd2lsbCBiZSBwcm9jZXNzZWQgb3ZlciBIVFRQUy4gKi9cbiAgYXN5bmMgbGlzdGVuKGFkZHI6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG4gIC8qKiBTdGFydCBsaXN0ZW5pbmcgZm9yIHJlcXVlc3RzLCBwcm9jZXNzaW5nIHJlZ2lzdGVyZWQgbWlkZGxld2FyZSBvbiBlYWNoXG4gICAqIHJlcXVlc3QuICBJZiB0aGUgb3B0aW9ucyBgLnNlY3VyZWAgaXMgdW5kZWZpbmVkIG9yIGBmYWxzZWAsIHRoZSBsaXN0ZW5pbmdcbiAgICogd2lsbCBiZSBvdmVyIEhUVFAuICBJZiB0aGUgb3B0aW9ucyBgLnNlY3VyZWAgcHJvcGVydHkgaXMgYHRydWVgLCBhXG4gICAqIGAuY2VydEZpbGVgIGFuZCBhIGAua2V5RmlsZWAgcHJvcGVydHkgbmVlZCB0byBiZSBzdXBwbGllZCBhbmQgcmVxdWVzdHNcbiAgICogd2lsbCBiZSBwcm9jZXNzZWQgb3ZlciBIVFRQUy5cbiAgICpcbiAgICogT21pdHRpbmcgb3B0aW9ucyB3aWxsIGRlZmF1bHQgdG8gYHsgcG9ydDogMCB9YCB3aGljaCBhbGxvd3MgdGhlIG9wZXJhdGluZ1xuICAgKiBzeXN0ZW0gdG8gc2VsZWN0IHRoZSBwb3J0LiAqL1xuICBhc3luYyBsaXN0ZW4ob3B0aW9ucz86IExpc3Rlbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuICBhc3luYyBsaXN0ZW4ob3B0aW9uczogc3RyaW5nIHwgTGlzdGVuT3B0aW9ucyA9IHsgcG9ydDogMCB9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLiNtaWRkbGV3YXJlLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlRoZXJlIGlzIG5vIG1pZGRsZXdhcmUgdG8gcHJvY2VzcyByZXF1ZXN0cy5cIik7XG4gICAgfVxuICAgIGZvciAoY29uc3QgbWlkZGxld2FyZSBvZiB0aGlzLiNtaWRkbGV3YXJlKSB7XG4gICAgICBpZiAoaXNNaWRkbGV3YXJlT2JqZWN0KG1pZGRsZXdhcmUpICYmIG1pZGRsZXdhcmUuaW5pdCkge1xuICAgICAgICBhd2FpdCBtaWRkbGV3YXJlLmluaXQoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IEFERFJfUkVHRVhQLmV4ZWMob3B0aW9ucyk7XG4gICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgIHRocm93IFR5cGVFcnJvcihgSW52YWxpZCBhZGRyZXNzIHBhc3NlZDogXCIke29wdGlvbnN9XCJgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IFssIGhvc3RuYW1lLCBwb3J0U3RyXSA9IG1hdGNoO1xuICAgICAgb3B0aW9ucyA9IHsgaG9zdG5hbWUsIHBvcnQ6IHBhcnNlSW50KHBvcnRTdHIsIDEwKSB9O1xuICAgIH1cbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7IHBvcnQ6IDAgfSwgb3B0aW9ucyk7XG4gICAgY29uc3Qgc2VydmVyID0gbmV3IHRoaXMuI3NlcnZlckNvbnN0cnVjdG9yKFxuICAgICAgdGhpcyxcbiAgICAgIG9wdGlvbnMgYXMgRGVuby5MaXN0ZW5PcHRpb25zLFxuICAgICk7XG4gICAgY29uc3QgeyBzaWduYWwgfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgc3RhdGUgPSB7XG4gICAgICBjbG9zZWQ6IGZhbHNlLFxuICAgICAgY2xvc2luZzogZmFsc2UsXG4gICAgICBoYW5kbGluZzogbmV3IFNldDxQcm9taXNlPHZvaWQ+PigpLFxuICAgICAgc2VydmVyLFxuICAgIH07XG4gICAgaWYgKHNpZ25hbCkge1xuICAgICAgc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCAoKSA9PiB7XG4gICAgICAgIGlmICghc3RhdGUuaGFuZGxpbmcuc2l6ZSkge1xuICAgICAgICAgIHNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgIHN0YXRlLmNsb3NlZCA9IHRydWU7XG4gICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyBBcHBsaWNhdGlvbkNsb3NlRXZlbnQoe30pKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5jbG9zaW5nID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCB7IHNlY3VyZSA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHNlcnZlclR5cGUgPSBzZXJ2ZXIgaW5zdGFuY2VvZiBIdHRwU2VydmVyID8gXCJuYXRpdmVcIiA6IFwiY3VzdG9tXCI7XG4gICAgY29uc3QgbGlzdGVuZXIgPSBhd2FpdCBzZXJ2ZXIubGlzdGVuKCk7XG4gICAgY29uc3QgeyBob3N0bmFtZSwgcG9ydCB9ID0gbGlzdGVuZXIuYWRkciBhcyBEZW5vLk5ldEFkZHI7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KFxuICAgICAgbmV3IEFwcGxpY2F0aW9uTGlzdGVuRXZlbnQoe1xuICAgICAgICBob3N0bmFtZSxcbiAgICAgICAgbGlzdGVuZXIsXG4gICAgICAgIHBvcnQsXG4gICAgICAgIHNlY3VyZSxcbiAgICAgICAgc2VydmVyVHlwZSxcbiAgICAgIH0pLFxuICAgICk7XG4gICAgdHJ5IHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgcmVxdWVzdCBvZiBzZXJ2ZXIpIHtcbiAgICAgICAgdGhpcy4jaGFuZGxlUmVxdWVzdChyZXF1ZXN0LCBzZWN1cmUsIHN0YXRlKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKHN0YXRlLmhhbmRsaW5nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgICAgPyBlcnJvci5tZXNzYWdlXG4gICAgICAgIDogXCJBcHBsaWNhdGlvbiBFcnJvclwiO1xuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBuZXcgQXBwbGljYXRpb25FcnJvckV2ZW50KHsgbWVzc2FnZSwgZXJyb3IgfSksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIHRvIGJlIHVzZWQgd2l0aCB0aGUgYXBwbGljYXRpb24uICBNaWRkbGV3YXJlIHdpbGxcbiAgICogYmUgcHJvY2Vzc2VkIGluIHRoZSBvcmRlciBpdCBpcyBhZGRlZCwgYnV0IG1pZGRsZXdhcmUgY2FuIGNvbnRyb2wgdGhlIGZsb3dcbiAgICogb2YgZXhlY3V0aW9uIHZpYSB0aGUgdXNlIG9mIHRoZSBgbmV4dCgpYCBmdW5jdGlvbiB0aGF0IHRoZSBtaWRkbGV3YXJlXG4gICAqIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIHdpdGguICBUaGUgYGNvbnRleHRgIG9iamVjdCBwcm92aWRlcyBpbmZvcm1hdGlvblxuICAgKiBhYm91dCB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAqXG4gICAqIEJhc2ljIHVzYWdlOlxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBjb25zdCBpbXBvcnQgeyBBcHBsaWNhdGlvbiB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L29hay9tb2QudHNcIjtcbiAgICpcbiAgICogY29uc3QgYXBwID0gbmV3IEFwcGxpY2F0aW9uKCk7XG4gICAqXG4gICAqIGFwcC51c2UoKGN0eCwgbmV4dCkgPT4ge1xuICAgKiAgIGN0eC5yZXF1ZXN0OyAvLyBjb250YWlucyByZXF1ZXN0IGluZm9ybWF0aW9uXG4gICAqICAgY3R4LnJlc3BvbnNlOyAvLyBzZXR1cHMgdXAgaW5mb3JtYXRpb24gdG8gdXNlIGluIHRoZSByZXNwb25zZTtcbiAgICogICBhd2FpdCBuZXh0KCk7IC8vIG1hbmFnZXMgdGhlIGZsb3cgY29udHJvbCBvZiB0aGUgbWlkZGxld2FyZSBleGVjdXRpb25cbiAgICogfSk7XG4gICAqXG4gICAqIGF3YWl0IGFwcC5saXN0ZW4oeyBwb3J0OiA4MCB9KTtcbiAgICogYGBgXG4gICAqL1xuICB1c2U8UyBleHRlbmRzIFN0YXRlID0gQVM+KFxuICAgIG1pZGRsZXdhcmU6IE1pZGRsZXdhcmVPck1pZGRsZXdhcmVPYmplY3Q8UywgQ29udGV4dDxTLCBBUz4+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBNaWRkbGV3YXJlT3JNaWRkbGV3YXJlT2JqZWN0PFMsIENvbnRleHQ8UywgQVM+PltdXG4gICk6IEFwcGxpY2F0aW9uPFMgZXh0ZW5kcyBBUyA/IFMgOiAoUyAmIEFTKT47XG4gIHVzZTxTIGV4dGVuZHMgU3RhdGUgPSBBUz4oXG4gICAgLi4ubWlkZGxld2FyZTogTWlkZGxld2FyZU9yTWlkZGxld2FyZU9iamVjdDxTLCBDb250ZXh0PFMsIEFTPj5bXVxuICApOiBBcHBsaWNhdGlvbjxTIGV4dGVuZHMgQVMgPyBTIDogKFMgJiBBUyk+IHtcbiAgICB0aGlzLiNtaWRkbGV3YXJlLnB1c2goLi4ubWlkZGxld2FyZSk7XG4gICAgdGhpcy4jY29tcG9zZWRNaWRkbGV3YXJlID0gdW5kZWZpbmVkO1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgcmV0dXJuIHRoaXMgYXMgQXBwbGljYXRpb248YW55PjtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXShpbnNwZWN0OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZykge1xuICAgIGNvbnN0IHsga2V5cywgcHJveHksIHN0YXRlIH0gPSB0aGlzO1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHsgXCIjbWlkZGxld2FyZVwiOiB0aGlzLiNtaWRkbGV3YXJlLCBrZXlzLCBwcm94eSwgc3RhdGUgfSlcbiAgICB9YDtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwibm9kZWpzLnV0aWwuaW5zcGVjdC5jdXN0b21cIildKFxuICAgIGRlcHRoOiBudW1iZXIsXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBvcHRpb25zOiBhbnksXG4gICAgaW5zcGVjdDogKHZhbHVlOiB1bmtub3duLCBvcHRpb25zPzogdW5rbm93bikgPT4gc3RyaW5nLFxuICApIHtcbiAgICBpZiAoZGVwdGggPCAwKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5zdHlsaXplKGBbJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9XWAsIFwic3BlY2lhbFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdPcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge1xuICAgICAgZGVwdGg6IG9wdGlvbnMuZGVwdGggPT09IG51bGwgPyBudWxsIDogb3B0aW9ucy5kZXB0aCAtIDEsXG4gICAgfSk7XG4gICAgY29uc3QgeyBrZXlzLCBwcm94eSwgc3RhdGUgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGAke29wdGlvbnMuc3R5bGl6ZSh0aGlzLmNvbnN0cnVjdG9yLm5hbWUsIFwic3BlY2lhbFwiKX0gJHtcbiAgICAgIGluc3BlY3QoXG4gICAgICAgIHsgXCIjbWlkZGxld2FyZVwiOiB0aGlzLiNtaWRkbGV3YXJlLCBrZXlzLCBwcm94eSwgc3RhdGUgfSxcbiAgICAgICAgbmV3T3B0aW9ucyxcbiAgICAgIClcbiAgICB9YDtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHlFQUF5RTtBQUV6RSxTQUFTLE9BQU8sUUFBUSxlQUFlO0FBQ3ZDLFNBQVMsUUFBUSxFQUFVLFdBQVcsUUFBUSxZQUFZO0FBQzFELFNBQVMsVUFBVSxRQUFRLDBCQUEwQjtBQUNyRCxTQUFTLGFBQWEsUUFBUSxrQ0FBa0M7QUFDaEUsU0FDRSxPQUFPLEVBQ1Asa0JBQWtCLFFBRWIsa0JBQWtCO0FBQ3pCLFNBQVMsVUFBVSxRQUFRLHdCQUF3QjtBQVFuRCxTQUFTLE1BQU0sRUFBRSxNQUFNLFFBQVEsWUFBWTtBQXdNM0MsTUFBTSxjQUFjO0FBRXBCLE1BQU0saUJBQW1EO0FBRXpELE9BQU8sTUFBTSw4QkFBOEI7RUFDekMsWUFBWSxhQUF3QixDQUFFO0lBQ3BDLEtBQUssQ0FBQyxTQUFTO0VBQ2pCO0FBQ0Y7QUFFQSxPQUFPLE1BQU0sOEJBQ0g7RUFDUixRQUF5QjtFQUV6QixZQUFZLGFBQStDLENBQUU7SUFDM0QsS0FBSyxDQUFDLFNBQVM7SUFDZixJQUFJLENBQUMsT0FBTyxHQUFHLGNBQWMsT0FBTztF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