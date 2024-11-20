// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * @deprecated (will be removed after 0.196.0) Use `ReadableStream.from` instead.
 *
 * Create a `ReadableStream` from any kind of iterable.
 *
 * ```ts
 *      import { readableStreamFromIterable } from "https://deno.land/std@$STD_VERSION/streams/readable_stream_from_iterable.ts";
 *
 *      const r1 = readableStreamFromIterable(["foo, bar, baz"]);
 *      const r2 = readableStreamFromIterable(async function* () {
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "foo";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "bar";
 *        await new Promise(((r) => setTimeout(r, 1000)));
 *        yield "baz";
 *      }());
 * ```
 *
 * If the produced iterator (`iterable[Symbol.asyncIterator]()` or
 * `iterable[Symbol.iterator]()`) is a generator, or more specifically is found
 * to have a `.throw()` method on it, that will be called upon
 * `readableStream.cancel()`. This is the case for the second input type above:
 *
 * ```ts
 * import { readableStreamFromIterable } from "https://deno.land/std@$STD_VERSION/streams/readable_stream_from_iterable.ts";
 *
 * const r3 = readableStreamFromIterable(async function* () {
 *   try {
 *     yield "foo";
 *   } catch (error) {
 *     console.log(error); // Error: Cancelled by consumer.
 *   }
 * }());
 * const reader = r3.getReader();
 * console.log(await reader.read()); // { value: "foo", done: false }
 * await reader.cancel(new Error("Cancelled by consumer."));
 * ```
 */ export function readableStreamFromIterable(iterable) {
  const iterator = iterable[Symbol.asyncIterator]?.() ?? iterable[Symbol.iterator]?.();
  return new ReadableStream({
    async pull (controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
    async cancel (reason) {
      if (typeof iterator.throw == "function") {
        try {
          await iterator.throw(reason);
        } catch  {}
      }
    }
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3N0cmVhbXMvcmVhZGFibGVfc3RyZWFtX2Zyb21faXRlcmFibGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLyoqXG4gKiBAZGVwcmVjYXRlZCAod2lsbCBiZSByZW1vdmVkIGFmdGVyIDAuMTk2LjApIFVzZSBgUmVhZGFibGVTdHJlYW0uZnJvbWAgaW5zdGVhZC5cbiAqXG4gKiBDcmVhdGUgYSBgUmVhZGFibGVTdHJlYW1gIGZyb20gYW55IGtpbmQgb2YgaXRlcmFibGUuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9zdHJlYW1zL3JlYWRhYmxlX3N0cmVhbV9mcm9tX2l0ZXJhYmxlLnRzXCI7XG4gKlxuICogICAgICBjb25zdCByMSA9IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlKFtcImZvbywgYmFyLCBiYXpcIl0pO1xuICogICAgICBjb25zdCByMiA9IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlKGFzeW5jIGZ1bmN0aW9uKiAoKSB7XG4gKiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKSk7XG4gKiAgICAgICAgeWllbGQgXCJmb29cIjtcbiAqICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCkpKTtcbiAqICAgICAgICB5aWVsZCBcImJhclwiO1xuICogICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKCgocikgPT4gc2V0VGltZW91dChyLCAxMDAwKSkpO1xuICogICAgICAgIHlpZWxkIFwiYmF6XCI7XG4gKiAgICAgIH0oKSk7XG4gKiBgYGBcbiAqXG4gKiBJZiB0aGUgcHJvZHVjZWQgaXRlcmF0b3IgKGBpdGVyYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKWAgb3JcbiAqIGBpdGVyYWJsZVtTeW1ib2wuaXRlcmF0b3JdKClgKSBpcyBhIGdlbmVyYXRvciwgb3IgbW9yZSBzcGVjaWZpY2FsbHkgaXMgZm91bmRcbiAqIHRvIGhhdmUgYSBgLnRocm93KClgIG1ldGhvZCBvbiBpdCwgdGhhdCB3aWxsIGJlIGNhbGxlZCB1cG9uXG4gKiBgcmVhZGFibGVTdHJlYW0uY2FuY2VsKClgLiBUaGlzIGlzIHRoZSBjYXNlIGZvciB0aGUgc2Vjb25kIGlucHV0IHR5cGUgYWJvdmU6XG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vc3RyZWFtcy9yZWFkYWJsZV9zdHJlYW1fZnJvbV9pdGVyYWJsZS50c1wiO1xuICpcbiAqIGNvbnN0IHIzID0gcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUoYXN5bmMgZnVuY3Rpb24qICgpIHtcbiAqICAgdHJ5IHtcbiAqICAgICB5aWVsZCBcImZvb1wiO1xuICogICB9IGNhdGNoIChlcnJvcikge1xuICogICAgIGNvbnNvbGUubG9nKGVycm9yKTsgLy8gRXJyb3I6IENhbmNlbGxlZCBieSBjb25zdW1lci5cbiAqICAgfVxuICogfSgpKTtcbiAqIGNvbnN0IHJlYWRlciA9IHIzLmdldFJlYWRlcigpO1xuICogY29uc29sZS5sb2coYXdhaXQgcmVhZGVyLnJlYWQoKSk7IC8vIHsgdmFsdWU6IFwiZm9vXCIsIGRvbmU6IGZhbHNlIH1cbiAqIGF3YWl0IHJlYWRlci5jYW5jZWwobmV3IEVycm9yKFwiQ2FuY2VsbGVkIGJ5IGNvbnN1bWVyLlwiKSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlPFQ+KFxuICBpdGVyYWJsZTogSXRlcmFibGU8VD4gfCBBc3luY0l0ZXJhYmxlPFQ+LFxuKTogUmVhZGFibGVTdHJlYW08VD4ge1xuICBjb25zdCBpdGVyYXRvcjogSXRlcmF0b3I8VD4gfCBBc3luY0l0ZXJhdG9yPFQ+ID1cbiAgICAoaXRlcmFibGUgYXMgQXN5bmNJdGVyYWJsZTxUPilbU3ltYm9sLmFzeW5jSXRlcmF0b3JdPy4oKSA/P1xuICAgICAgKGl0ZXJhYmxlIGFzIEl0ZXJhYmxlPFQ+KVtTeW1ib2wuaXRlcmF0b3JdPy4oKTtcbiAgcmV0dXJuIG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgYXN5bmMgcHVsbChjb250cm9sbGVyKSB7XG4gICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoZG9uZSkge1xuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUodmFsdWUpO1xuICAgICAgfVxuICAgIH0sXG4gICAgYXN5bmMgY2FuY2VsKHJlYXNvbikge1xuICAgICAgaWYgKHR5cGVvZiBpdGVyYXRvci50aHJvdyA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBpdGVyYXRvci50aHJvdyhyZWFzb24pO1xuICAgICAgICB9IGNhdGNoIHsgLyogYGl0ZXJhdG9yLnRocm93KClgIGFsd2F5cyB0aHJvd3Mgb24gc2l0ZS4gV2UgY2F0Y2ggaXQuICovIH1cbiAgICAgIH1cbiAgICB9LFxuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXNDQyxHQUNELE9BQU8sU0FBUywyQkFDZCxRQUF3QztFQUV4QyxNQUFNLFdBQ0osQUFBQyxRQUE2QixDQUFDLE9BQU8sYUFBYSxDQUFDLFFBQ2xELEFBQUMsUUFBd0IsQ0FBQyxPQUFPLFFBQVEsQ0FBQztFQUM5QyxPQUFPLElBQUksZUFBZTtJQUN4QixNQUFNLE1BQUssVUFBVTtNQUNuQixNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sU0FBUyxJQUFJO01BQzNDLElBQUksTUFBTTtRQUNSLFdBQVcsS0FBSztNQUNsQixPQUFPO1FBQ0wsV0FBVyxPQUFPLENBQUM7TUFDckI7SUFDRjtJQUNBLE1BQU0sUUFBTyxNQUFNO01BQ2pCLElBQUksT0FBTyxTQUFTLEtBQUssSUFBSSxZQUFZO1FBQ3ZDLElBQUk7VUFDRixNQUFNLFNBQVMsS0FBSyxDQUFDO1FBQ3ZCLEVBQUUsT0FBTSxDQUErRDtNQUN6RTtJQUNGO0VBQ0Y7QUFDRiJ9