// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.
import { NativeRequest } from "./http_server_native_request.ts";
import { assert, isListenTlsOptions } from "./util.ts";
const serveHttp = "serveHttp" in Deno ? Deno.serveHttp.bind(Deno) : undefined;
/** The oak abstraction of the Deno native HTTP server which is used internally
 * for handling native HTTP requests. Generally users of oak do not need to
 * worry about this class. */ // deno-lint-ignore no-explicit-any
export class HttpServer {
  #app;
  #closed = false;
  #listener;
  #httpConnections = new Set();
  #options;
  constructor(app, options){
    if (!("serveHttp" in Deno)) {
      throw new Error("The native bindings for serving HTTP are not available.");
    }
    this.#app = app;
    this.#options = options;
  }
  get app() {
    return this.#app;
  }
  get closed() {
    return this.#closed;
  }
  close() {
    this.#closed = true;
    if (this.#listener) {
      this.#listener.close();
      this.#listener = undefined;
    }
    for (const httpConn of this.#httpConnections){
      try {
        httpConn.close();
      } catch (error) {
        if (!(error instanceof Deno.errors.BadResource)) {
          throw error;
        }
      }
    }
    this.#httpConnections.clear();
  }
  listen() {
    return this.#listener = isListenTlsOptions(this.#options) ? Deno.listenTls(this.#options) : Deno.listen(this.#options);
  }
  #trackHttpConnection(httpConn) {
    this.#httpConnections.add(httpConn);
  }
  #untrackHttpConnection(httpConn) {
    this.#httpConnections.delete(httpConn);
  }
  [Symbol.asyncIterator]() {
    const start = (controller)=>{
      // deno-lint-ignore no-this-alias
      const server = this;
      async function serve(conn) {
        const httpConn = serveHttp(conn);
        server.#trackHttpConnection(httpConn);
        while(true){
          try {
            const requestEvent = await httpConn.nextRequest();
            if (requestEvent === null) {
              server.#untrackHttpConnection(httpConn);
              return;
            }
            const nativeRequest = new NativeRequest(requestEvent, {
              conn
            });
            controller.enqueue(nativeRequest);
            // if we await here, this becomes blocking, and really all we want
            // it to dispatch any errors that occur on the promise
            nativeRequest.donePromise.catch((error)=>{
              server.app.dispatchEvent(new ErrorEvent("error", {
                error
              }));
            });
          } catch (error) {
            server.app.dispatchEvent(new ErrorEvent("error", {
              error
            }));
          }
          if (server.closed) {
            server.#untrackHttpConnection(httpConn);
            httpConn.close();
            controller.close();
          }
        }
      }
      const listener = this.#listener;
      assert(listener);
      async function accept() {
        while(true){
          try {
            const conn = await listener.accept();
            serve(conn);
          } catch (error) {
            if (!server.closed) {
              server.app.dispatchEvent(new ErrorEvent("error", {
                error
              }));
            }
          }
          if (server.closed) {
            controller.close();
            return;
          }
        }
      }
      accept();
    };
    const stream = new ReadableStream({
      start
    });
    return stream[Symbol.asyncIterator]();
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrQHYxMi42LjEvaHR0cF9zZXJ2ZXJfbmF0aXZlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjMgdGhlIG9hayBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvbiwgU3RhdGUgfSBmcm9tIFwiLi9hcHBsaWNhdGlvbi50c1wiO1xuaW1wb3J0IHsgTmF0aXZlUmVxdWVzdCB9IGZyb20gXCIuL2h0dHBfc2VydmVyX25hdGl2ZV9yZXF1ZXN0LnRzXCI7XG5pbXBvcnQgdHlwZSB7IEh0dHBDb25uLCBMaXN0ZW5lciwgU2VydmVyIH0gZnJvbSBcIi4vdHlwZXMuZC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0LCBpc0xpc3RlblRsc09wdGlvbnMgfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbi8vIHRoaXMgaXMgaW5jbHVkZWQgc28gd2hlbiBkb3duLWVtaXR0aW5nIHRvIG5wbS9Ob2RlLmpzLCBSZWFkYWJsZVN0cmVhbSBoYXNcbi8vIGFzeW5jIGl0ZXJhdG9yc1xuZGVjbGFyZSBnbG9iYWwge1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBpbnRlcmZhY2UgUmVhZGFibGVTdHJlYW08UiA9IGFueT4ge1xuICAgIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0ob3B0aW9ucz86IHtcbiAgICAgIHByZXZlbnRDYW5jZWw/OiBib29sZWFuO1xuICAgIH0pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8Uj47XG4gIH1cbn1cblxuZXhwb3J0IHR5cGUgUmVzcG9uZCA9IChyOiBSZXNwb25zZSB8IFByb21pc2U8UmVzcG9uc2U+KSA9PiB2b2lkO1xuXG4vLyBUaGlzIHR5cGUgaXMgcGFydCBvZiBEZW5vLCBidXQgbm90IHBhcnQgb2YgbGliLmRvbS5kLnRzLCB0aGVyZWZvcmUgYWRkIGl0IGhlcmVcbi8vIHNvIHRoYXQgdHlwZSBjaGVja2luZyBjYW4gb2NjdXIgcHJvcGVybHkgdW5kZXIgYGxpYi5kb20uZC50c2AuXG5pbnRlcmZhY2UgUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlckNhbGxiYWNrPFI+IHtcbiAgKGNvbnRyb2xsZXI6IFJlYWRhYmxlU3RyZWFtRGVmYXVsdENvbnRyb2xsZXI8Uj4pOiB2b2lkIHwgUHJvbWlzZUxpa2U8dm9pZD47XG59XG5cbmNvbnN0IHNlcnZlSHR0cDogKGNvbm46IERlbm8uQ29ubikgPT4gSHR0cENvbm4gPSBcInNlcnZlSHR0cFwiIGluIERlbm9cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgPyAoRGVubyBhcyBhbnkpLnNlcnZlSHR0cC5iaW5kKERlbm8pXG4gIDogdW5kZWZpbmVkO1xuXG4vKiogVGhlIG9hayBhYnN0cmFjdGlvbiBvZiB0aGUgRGVubyBuYXRpdmUgSFRUUCBzZXJ2ZXIgd2hpY2ggaXMgdXNlZCBpbnRlcm5hbGx5XG4gKiBmb3IgaGFuZGxpbmcgbmF0aXZlIEhUVFAgcmVxdWVzdHMuIEdlbmVyYWxseSB1c2VycyBvZiBvYWsgZG8gbm90IG5lZWQgdG9cbiAqIHdvcnJ5IGFib3V0IHRoaXMgY2xhc3MuICovXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZXhwb3J0IGNsYXNzIEh0dHBTZXJ2ZXI8QVMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4+XG4gIGltcGxlbWVudHMgU2VydmVyPE5hdGl2ZVJlcXVlc3Q+IHtcbiAgI2FwcDogQXBwbGljYXRpb248QVM+O1xuICAjY2xvc2VkID0gZmFsc2U7XG4gICNsaXN0ZW5lcj86IERlbm8uTGlzdGVuZXI7XG4gICNodHRwQ29ubmVjdGlvbnM6IFNldDxIdHRwQ29ubj4gPSBuZXcgU2V0KCk7XG4gICNvcHRpb25zOiBEZW5vLkxpc3Rlbk9wdGlvbnMgfCBEZW5vLkxpc3RlblRsc09wdGlvbnM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHBsaWNhdGlvbjxBUz4sXG4gICAgb3B0aW9uczogRGVuby5MaXN0ZW5PcHRpb25zIHwgRGVuby5MaXN0ZW5UbHNPcHRpb25zLFxuICApIHtcbiAgICBpZiAoIShcInNlcnZlSHR0cFwiIGluIERlbm8pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiVGhlIG5hdGl2ZSBiaW5kaW5ncyBmb3Igc2VydmluZyBIVFRQIGFyZSBub3QgYXZhaWxhYmxlLlwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy4jYXBwID0gYXBwO1xuICAgIHRoaXMuI29wdGlvbnMgPSBvcHRpb25zO1xuICB9XG5cbiAgZ2V0IGFwcCgpOiBBcHBsaWNhdGlvbjxBUz4ge1xuICAgIHJldHVybiB0aGlzLiNhcHA7XG4gIH1cblxuICBnZXQgY2xvc2VkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLiNjbG9zZWQ7XG4gIH1cblxuICBjbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLiNjbG9zZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuI2xpc3RlbmVyKSB7XG4gICAgICB0aGlzLiNsaXN0ZW5lci5jbG9zZSgpO1xuICAgICAgdGhpcy4jbGlzdGVuZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBodHRwQ29ubiBvZiB0aGlzLiNodHRwQ29ubmVjdGlvbnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGh0dHBDb25uLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoIShlcnJvciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlKSkge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy4jaHR0cENvbm5lY3Rpb25zLmNsZWFyKCk7XG4gIH1cblxuICBsaXN0ZW4oKTogTGlzdGVuZXIge1xuICAgIHJldHVybiAodGhpcy4jbGlzdGVuZXIgPSBpc0xpc3RlblRsc09wdGlvbnModGhpcy4jb3B0aW9ucylcbiAgICAgID8gRGVuby5saXN0ZW5UbHModGhpcy4jb3B0aW9ucylcbiAgICAgIDogRGVuby5saXN0ZW4odGhpcy4jb3B0aW9ucykpIGFzIExpc3RlbmVyO1xuICB9XG5cbiAgI3RyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm46IEh0dHBDb25uKTogdm9pZCB7XG4gICAgdGhpcy4jaHR0cENvbm5lY3Rpb25zLmFkZChodHRwQ29ubik7XG4gIH1cblxuICAjdW50cmFja0h0dHBDb25uZWN0aW9uKGh0dHBDb25uOiBIdHRwQ29ubik6IHZvaWQge1xuICAgIHRoaXMuI2h0dHBDb25uZWN0aW9ucy5kZWxldGUoaHR0cENvbm4pO1xuICB9XG5cbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8TmF0aXZlUmVxdWVzdD4ge1xuICAgIGNvbnN0IHN0YXJ0OiBSZWFkYWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyQ2FsbGJhY2s8TmF0aXZlUmVxdWVzdD4gPSAoXG4gICAgICBjb250cm9sbGVyLFxuICAgICkgPT4ge1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby10aGlzLWFsaWFzXG4gICAgICBjb25zdCBzZXJ2ZXIgPSB0aGlzO1xuICAgICAgYXN5bmMgZnVuY3Rpb24gc2VydmUoY29ubjogRGVuby5Db25uKSB7XG4gICAgICAgIGNvbnN0IGh0dHBDb25uID0gc2VydmVIdHRwKGNvbm4pO1xuICAgICAgICBzZXJ2ZXIuI3RyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm4pO1xuXG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RFdmVudCA9IGF3YWl0IGh0dHBDb25uLm5leHRSZXF1ZXN0KCk7XG5cbiAgICAgICAgICAgIGlmIChyZXF1ZXN0RXZlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgc2VydmVyLiN1bnRyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm4pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5hdGl2ZVJlcXVlc3QgPSBuZXcgTmF0aXZlUmVxdWVzdChyZXF1ZXN0RXZlbnQsIHsgY29ubiB9KTtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShuYXRpdmVSZXF1ZXN0KTtcbiAgICAgICAgICAgIC8vIGlmIHdlIGF3YWl0IGhlcmUsIHRoaXMgYmVjb21lcyBibG9ja2luZywgYW5kIHJlYWxseSBhbGwgd2Ugd2FudFxuICAgICAgICAgICAgLy8gaXQgdG8gZGlzcGF0Y2ggYW55IGVycm9ycyB0aGF0IG9jY3VyIG9uIHRoZSBwcm9taXNlXG4gICAgICAgICAgICBuYXRpdmVSZXF1ZXN0LmRvbmVQcm9taXNlLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICBzZXJ2ZXIuYXBwLmRpc3BhdGNoRXZlbnQobmV3IEVycm9yRXZlbnQoXCJlcnJvclwiLCB7IGVycm9yIH0pKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBzZXJ2ZXIuYXBwLmRpc3BhdGNoRXZlbnQobmV3IEVycm9yRXZlbnQoXCJlcnJvclwiLCB7IGVycm9yIH0pKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoc2VydmVyLmNsb3NlZCkge1xuICAgICAgICAgICAgc2VydmVyLiN1bnRyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm4pO1xuICAgICAgICAgICAgaHR0cENvbm4uY2xvc2UoKTtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgbGlzdGVuZXIgPSB0aGlzLiNsaXN0ZW5lcjtcbiAgICAgIGFzc2VydChsaXN0ZW5lcik7XG4gICAgICBhc3luYyBmdW5jdGlvbiBhY2NlcHQoKSB7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbm4gPSBhd2FpdCBsaXN0ZW5lciEuYWNjZXB0KCk7XG4gICAgICAgICAgICBzZXJ2ZShjb25uKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgaWYgKCFzZXJ2ZXIuY2xvc2VkKSB7XG4gICAgICAgICAgICAgIHNlcnZlci5hcHAuZGlzcGF0Y2hFdmVudChuZXcgRXJyb3JFdmVudChcImVycm9yXCIsIHsgZXJyb3IgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VydmVyLmNsb3NlZCkge1xuICAgICAgICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBhY2NlcHQoKTtcbiAgICB9O1xuICAgIGNvbnN0IHN0cmVhbSA9IG5ldyBSZWFkYWJsZVN0cmVhbTxOYXRpdmVSZXF1ZXN0Pih7IHN0YXJ0IH0pO1xuXG4gICAgcmV0dXJuIHN0cmVhbVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHlFQUF5RTtBQUd6RSxTQUFTLGFBQWEsUUFBUSxrQ0FBa0M7QUFFaEUsU0FBUyxNQUFNLEVBQUUsa0JBQWtCLFFBQVEsWUFBWTtBQXFCdkQsTUFBTSxZQUEyQyxlQUFlLE9BRTVELEFBQUMsS0FBYSxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQzdCO0FBRUo7OzJCQUUyQixHQUMzQixtQ0FBbUM7QUFDbkMsT0FBTyxNQUFNO0VBRVgsQ0FBQyxHQUFHLENBQWtCO0VBQ3RCLENBQUMsTUFBTSxHQUFHLE1BQU07RUFDaEIsQ0FBQyxRQUFRLENBQWlCO0VBQzFCLENBQUMsZUFBZSxHQUFrQixJQUFJLE1BQU07RUFDNUMsQ0FBQyxPQUFPLENBQTZDO0VBRXJELFlBQ0Us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