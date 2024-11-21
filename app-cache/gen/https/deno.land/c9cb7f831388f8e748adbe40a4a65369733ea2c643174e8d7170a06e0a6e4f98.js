// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import { digestAlgorithms as wasmDigestAlgorithms, instantiateWasm } from "../_wasm_crypto/mod.ts";
import { fnv } from "./_fnv/index.ts";
/**
 * A copy of the global WebCrypto interface, with methods bound so they're
 * safe to re-export.
 * @module
 */ const webCrypto = ((crypto)=>({
    getRandomValues: crypto.getRandomValues?.bind(crypto),
    randomUUID: crypto.randomUUID?.bind(crypto),
    subtle: {
      decrypt: crypto.subtle?.decrypt?.bind(crypto.subtle),
      deriveBits: crypto.subtle?.deriveBits?.bind(crypto.subtle),
      deriveKey: crypto.subtle?.deriveKey?.bind(crypto.subtle),
      digest: crypto.subtle?.digest?.bind(crypto.subtle),
      encrypt: crypto.subtle?.encrypt?.bind(crypto.subtle),
      exportKey: crypto.subtle?.exportKey?.bind(crypto.subtle),
      generateKey: crypto.subtle?.generateKey?.bind(crypto.subtle),
      importKey: crypto.subtle?.importKey?.bind(crypto.subtle),
      sign: crypto.subtle?.sign?.bind(crypto.subtle),
      unwrapKey: crypto.subtle?.unwrapKey?.bind(crypto.subtle),
      verify: crypto.subtle?.verify?.bind(crypto.subtle),
      wrapKey: crypto.subtle?.wrapKey?.bind(crypto.subtle)
    }
  }))(globalThis.crypto);
const bufferSourceBytes = (data)=>{
  let bytes;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  }
  return bytes;
};
/**
 * An wrapper for WebCrypto adding support for additional non-standard
 * algorithms, but delegating to the runtime WebCrypto implementation whenever
 * possible.
 */ const stdCrypto = ((x)=>x)({
  ...webCrypto,
  subtle: {
    ...webCrypto.subtle,
    /**
     * Returns a new `Promise` object that will digest `data` using the specified
     * `AlgorithmIdentifier`.
     */ async digest (algorithm, data) {
      const { name, length } = normalizeAlgorithm(algorithm);
      const bytes = bufferSourceBytes(data);
      if (FNVAlgorithms.includes(name)) {
        return fnv(name, bytes);
      }
      // We delegate to WebCrypto whenever possible,
      if (// if the algorithm is supported by the WebCrypto standard,
      webCryptoDigestAlgorithms.includes(name) && // and the data is a single buffer,
      bytes) {
        return webCrypto.subtle.digest(algorithm, bytes);
      } else if (wasmDigestAlgorithms.includes(name)) {
        if (bytes) {
          // Otherwise, we use our bundled Wasm implementation via digestSync
          // if it supports the algorithm.
          return stdCrypto.subtle.digestSync(algorithm, bytes);
        } else if (data[Symbol.iterator]) {
          return stdCrypto.subtle.digestSync(algorithm, data);
        } else if (data[Symbol.asyncIterator]) {
          const wasmCrypto = instantiateWasm();
          const context = new wasmCrypto.DigestContext(name);
          for await (const chunk of data){
            const chunkBytes = bufferSourceBytes(chunk);
            if (!chunkBytes) {
              throw new TypeError("data contained chunk of the wrong type");
            }
            context.update(chunkBytes);
          }
          return context.digestAndDrop(length).buffer;
        } else {
          throw new TypeError("data must be a BufferSource or [Async]Iterable<BufferSource>");
        }
      } else if (webCrypto.subtle?.digest) {
        // (TypeScript type definitions prohibit this case.) If they're trying
        // to call an algorithm we don't recognize, pass it along to WebCrypto
        // in case it's a non-standard algorithm supported by the the runtime
        // they're using.
        return webCrypto.subtle.digest(algorithm, data);
      } else {
        throw new TypeError(`unsupported digest algorithm: ${algorithm}`);
      }
    },
    /**
     * Returns a ArrayBuffer with the result of digesting `data` using the
     * specified `AlgorithmIdentifier`.
     */ digestSync (algorithm, data) {
      algorithm = normalizeAlgorithm(algorithm);
      const bytes = bufferSourceBytes(data);
      if (FNVAlgorithms.includes(algorithm.name)) {
        return fnv(algorithm.name, bytes);
      }
      const wasmCrypto = instantiateWasm();
      if (bytes) {
        return wasmCrypto.digest(algorithm.name, bytes, algorithm.length).buffer;
      } else if (data[Symbol.iterator]) {
        const context = new wasmCrypto.DigestContext(algorithm.name);
        for (const chunk of data){
          const chunkBytes = bufferSourceBytes(chunk);
          if (!chunkBytes) {
            throw new TypeError("data contained chunk of the wrong type");
          }
          context.update(chunkBytes);
        }
        return context.digestAndDrop(algorithm.length).buffer;
      } else {
        throw new TypeError("data must be a BufferSource or Iterable<BufferSource>");
      }
    }
  }
});
const FNVAlgorithms = [
  "FNV32",
  "FNV32A",
  "FNV64",
  "FNV64A"
];
/** Digest algorithms supported by WebCrypto. */ const webCryptoDigestAlgorithms = [
  "SHA-384",
  "SHA-256",
  "SHA-512",
  // insecure (length-extendable and collidable):
  "SHA-1"
];
const normalizeAlgorithm = (algorithm)=>typeof algorithm === "string" ? {
    name: algorithm.toUpperCase()
  } : {
    ...algorithm,
    name: algorithm.name.toUpperCase()
  };
export { stdCrypto as crypto };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjE0OS4wL2NyeXB0by9tb2QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7XG4gIERpZ2VzdEFsZ29yaXRobSBhcyBXYXNtRGlnZXN0QWxnb3JpdGhtLFxuICBkaWdlc3RBbGdvcml0aG1zIGFzIHdhc21EaWdlc3RBbGdvcml0aG1zLFxuICBpbnN0YW50aWF0ZVdhc20sXG59IGZyb20gXCIuLi9fd2FzbV9jcnlwdG8vbW9kLnRzXCI7XG5cbmltcG9ydCB7IGZudiB9IGZyb20gXCIuL19mbnYvaW5kZXgudHNcIjtcblxuLyoqXG4gKiBBIGNvcHkgb2YgdGhlIGdsb2JhbCBXZWJDcnlwdG8gaW50ZXJmYWNlLCB3aXRoIG1ldGhvZHMgYm91bmQgc28gdGhleSdyZVxuICogc2FmZSB0byByZS1leHBvcnQuXG4gKiBAbW9kdWxlXG4gKi9cbmNvbnN0IHdlYkNyeXB0byA9ICgoY3J5cHRvKSA9PiAoe1xuICBnZXRSYW5kb21WYWx1ZXM6IGNyeXB0by5nZXRSYW5kb21WYWx1ZXM/LmJpbmQoY3J5cHRvKSxcbiAgcmFuZG9tVVVJRDogY3J5cHRvLnJhbmRvbVVVSUQ/LmJpbmQoY3J5cHRvKSxcbiAgc3VidGxlOiB7XG4gICAgZGVjcnlwdDogY3J5cHRvLnN1YnRsZT8uZGVjcnlwdD8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgICBkZXJpdmVCaXRzOiBjcnlwdG8uc3VidGxlPy5kZXJpdmVCaXRzPy5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGRlcml2ZUtleTogY3J5cHRvLnN1YnRsZT8uZGVyaXZlS2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGRpZ2VzdDogY3J5cHRvLnN1YnRsZT8uZGlnZXN0Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGVuY3J5cHQ6IGNyeXB0by5zdWJ0bGU/LmVuY3J5cHQ/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgZXhwb3J0S2V5OiBjcnlwdG8uc3VidGxlPy5leHBvcnRLZXk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgZ2VuZXJhdGVLZXk6IGNyeXB0by5zdWJ0bGU/LmdlbmVyYXRlS2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIGltcG9ydEtleTogY3J5cHRvLnN1YnRsZT8uaW1wb3J0S2V5Py5iaW5kKGNyeXB0by5zdWJ0bGUpLFxuICAgIHNpZ246IGNyeXB0by5zdWJ0bGU/LnNpZ24/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgdW53cmFwS2V5OiBjcnlwdG8uc3VidGxlPy51bndyYXBLZXk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgdmVyaWZ5OiBjcnlwdG8uc3VidGxlPy52ZXJpZnk/LmJpbmQoY3J5cHRvLnN1YnRsZSksXG4gICAgd3JhcEtleTogY3J5cHRvLnN1YnRsZT8ud3JhcEtleT8uYmluZChjcnlwdG8uc3VidGxlKSxcbiAgfSxcbn0pKShnbG9iYWxUaGlzLmNyeXB0byk7XG5cbmNvbnN0IGJ1ZmZlclNvdXJjZUJ5dGVzID0gKGRhdGE6IEJ1ZmZlclNvdXJjZSB8IHVua25vd24pID0+IHtcbiAgbGV0IGJ5dGVzOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuICBpZiAoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICBieXRlcyA9IGRhdGE7XG4gIH0gZWxzZSBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KGRhdGEpKSB7XG4gICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0LCBkYXRhLmJ5dGVMZW5ndGgpO1xuICB9IGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gIH1cbiAgcmV0dXJuIGJ5dGVzO1xufTtcblxuLyoqXG4gKiBBbiB3cmFwcGVyIGZvciBXZWJDcnlwdG8gYWRkaW5nIHN1cHBvcnQgZm9yIGFkZGl0aW9uYWwgbm9uLXN0YW5kYXJkXG4gKiBhbGdvcml0aG1zLCBidXQgZGVsZWdhdGluZyB0byB0aGUgcnVudGltZSBXZWJDcnlwdG8gaW1wbGVtZW50YXRpb24gd2hlbmV2ZXJcbiAqIHBvc3NpYmxlLlxuICovXG5jb25zdCBzdGRDcnlwdG8gPSAoKHgpID0+IHgpKHtcbiAgLi4ud2ViQ3J5cHRvLFxuICBzdWJ0bGU6IHtcbiAgICAuLi53ZWJDcnlwdG8uc3VidGxlLFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIG5ldyBgUHJvbWlzZWAgb2JqZWN0IHRoYXQgd2lsbCBkaWdlc3QgYGRhdGFgIHVzaW5nIHRoZSBzcGVjaWZpZWRcbiAgICAgKiBgQWxnb3JpdGhtSWRlbnRpZmllcmAuXG4gICAgICovXG4gICAgYXN5bmMgZGlnZXN0KFxuICAgICAgYWxnb3JpdGhtOiBEaWdlc3RBbGdvcml0aG0sXG4gICAgICBkYXRhOiBCdWZmZXJTb3VyY2UgfCBBc3luY0l0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4gfCBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+LFxuICAgICk6IFByb21pc2U8QXJyYXlCdWZmZXI+IHtcbiAgICAgIGNvbnN0IHsgbmFtZSwgbGVuZ3RoIH0gPSBub3JtYWxpemVBbGdvcml0aG0oYWxnb3JpdGhtKTtcbiAgICAgIGNvbnN0IGJ5dGVzID0gYnVmZmVyU291cmNlQnl0ZXMoZGF0YSk7XG5cbiAgICAgIGlmIChGTlZBbGdvcml0aG1zLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgICAgIHJldHVybiBmbnYobmFtZSwgYnl0ZXMpO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBkZWxlZ2F0ZSB0byBXZWJDcnlwdG8gd2hlbmV2ZXIgcG9zc2libGUsXG4gICAgICBpZiAoXG4gICAgICAgIC8vIGlmIHRoZSBhbGdvcml0aG0gaXMgc3VwcG9ydGVkIGJ5IHRoZSBXZWJDcnlwdG8gc3RhbmRhcmQsXG4gICAgICAgICh3ZWJDcnlwdG9EaWdlc3RBbGdvcml0aG1zIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhuYW1lKSAmJlxuICAgICAgICAvLyBhbmQgdGhlIGRhdGEgaXMgYSBzaW5nbGUgYnVmZmVyLFxuICAgICAgICBieXRlc1xuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB3ZWJDcnlwdG8uc3VidGxlLmRpZ2VzdChhbGdvcml0aG0sIGJ5dGVzKTtcbiAgICAgIH0gZWxzZSBpZiAod2FzbURpZ2VzdEFsZ29yaXRobXMuaW5jbHVkZXMobmFtZSBhcyBXYXNtRGlnZXN0QWxnb3JpdGhtKSkge1xuICAgICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgICAvLyBPdGhlcndpc2UsIHdlIHVzZSBvdXIgYnVuZGxlZCBXYXNtIGltcGxlbWVudGF0aW9uIHZpYSBkaWdlc3RTeW5jXG4gICAgICAgICAgLy8gaWYgaXQgc3VwcG9ydHMgdGhlIGFsZ29yaXRobS5cbiAgICAgICAgICByZXR1cm4gc3RkQ3J5cHRvLnN1YnRsZS5kaWdlc3RTeW5jKGFsZ29yaXRobSwgYnl0ZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKChkYXRhIGFzIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pW1N5bWJvbC5pdGVyYXRvcl0pIHtcbiAgICAgICAgICByZXR1cm4gc3RkQ3J5cHRvLnN1YnRsZS5kaWdlc3RTeW5jKFxuICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgZGF0YSBhcyBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+LFxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgKGRhdGEgYXMgQXN5bmNJdGVyYWJsZTxCdWZmZXJTb3VyY2U+KVtTeW1ib2wuYXN5bmNJdGVyYXRvcl1cbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3Qgd2FzbUNyeXB0byA9IGluc3RhbnRpYXRlV2FzbSgpO1xuICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgd2FzbUNyeXB0by5EaWdlc3RDb250ZXh0KG5hbWUpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgZGF0YSBhcyBBc3luY0l0ZXJhYmxlPEJ1ZmZlclNvdXJjZT4pIHtcbiAgICAgICAgICAgIGNvbnN0IGNodW5rQnl0ZXMgPSBidWZmZXJTb3VyY2VCeXRlcyhjaHVuayk7XG4gICAgICAgICAgICBpZiAoIWNodW5rQnl0ZXMpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImRhdGEgY29udGFpbmVkIGNodW5rIG9mIHRoZSB3cm9uZyB0eXBlXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC51cGRhdGUoY2h1bmtCeXRlcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjb250ZXh0LmRpZ2VzdEFuZERyb3AobGVuZ3RoKS5idWZmZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIFwiZGF0YSBtdXN0IGJlIGEgQnVmZmVyU291cmNlIG9yIFtBc3luY11JdGVyYWJsZTxCdWZmZXJTb3VyY2U+XCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh3ZWJDcnlwdG8uc3VidGxlPy5kaWdlc3QpIHtcbiAgICAgICAgLy8gKFR5cGVTY3JpcHQgdHlwZSBkZWZpbml0aW9ucyBwcm9oaWJpdCB0aGlzIGNhc2UuKSBJZiB0aGV5J3JlIHRyeWluZ1xuICAgICAgICAvLyB0byBjYWxsIGFuIGFsZ29yaXRobSB3ZSBkb24ndCByZWNvZ25pemUsIHBhc3MgaXQgYWxvbmcgdG8gV2ViQ3J5cHRvXG4gICAgICAgIC8vIGluIGNhc2UgaXQncyBhIG5vbi1zdGFuZGFyZCBhbGdvcml0aG0gc3VwcG9ydGVkIGJ5IHRoZSB0aGUgcnVudGltZVxuICAgICAgICAvLyB0aGV5J3JlIHVzaW5nLlxuICAgICAgICByZXR1cm4gd2ViQ3J5cHRvLnN1YnRsZS5kaWdlc3QoXG4gICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgIChkYXRhIGFzIHVua25vd24pIGFzIFVpbnQ4QXJyYXksXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGB1bnN1cHBvcnRlZCBkaWdlc3QgYWxnb3JpdGhtOiAke2FsZ29yaXRobX1gKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIEFycmF5QnVmZmVyIHdpdGggdGhlIHJlc3VsdCBvZiBkaWdlc3RpbmcgYGRhdGFgIHVzaW5nIHRoZVxuICAgICAqIHNwZWNpZmllZCBgQWxnb3JpdGhtSWRlbnRpZmllcmAuXG4gICAgICovXG4gICAgZGlnZXN0U3luYyhcbiAgICAgIGFsZ29yaXRobTogRGlnZXN0QWxnb3JpdGhtLFxuICAgICAgZGF0YTogQnVmZmVyU291cmNlIHwgSXRlcmFibGU8QnVmZmVyU291cmNlPixcbiAgICApOiBBcnJheUJ1ZmZlciB7XG4gICAgICBhbGdvcml0aG0gPSBub3JtYWxpemVBbGdvcml0aG0oYWxnb3JpdGhtKTtcblxuICAgICAgY29uc3QgYnl0ZXMgPSBidWZmZXJTb3VyY2VCeXRlcyhkYXRhKTtcblxuICAgICAgaWYgKEZOVkFsZ29yaXRobXMuaW5jbHVkZXMoYWxnb3JpdGhtLm5hbWUpKSB7XG4gICAgICAgIHJldHVybiBmbnYoYWxnb3JpdGhtLm5hbWUsIGJ5dGVzKTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgd2FzbUNyeXB0byA9IGluc3RhbnRpYXRlV2FzbSgpO1xuICAgICAgaWYgKGJ5dGVzKSB7XG4gICAgICAgIHJldHVybiB3YXNtQ3J5cHRvLmRpZ2VzdChhbGdvcml0aG0ubmFtZSwgYnl0ZXMsIGFsZ29yaXRobS5sZW5ndGgpXG4gICAgICAgICAgLmJ1ZmZlcjtcbiAgICAgIH0gZWxzZSBpZiAoKGRhdGEgYXMgSXRlcmFibGU8QnVmZmVyU291cmNlPilbU3ltYm9sLml0ZXJhdG9yXSkge1xuICAgICAgICBjb25zdCBjb250ZXh0ID0gbmV3IHdhc21DcnlwdG8uRGlnZXN0Q29udGV4dChhbGdvcml0aG0ubmFtZSk7XG4gICAgICAgIGZvciAoY29uc3QgY2h1bmsgb2YgZGF0YSBhcyBJdGVyYWJsZTxCdWZmZXJTb3VyY2U+KSB7XG4gICAgICAgICAgY29uc3QgY2h1bmtCeXRlcyA9IGJ1ZmZlclNvdXJjZUJ5dGVzKGNodW5rKTtcbiAgICAgICAgICBpZiAoIWNodW5rQnl0ZXMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJkYXRhIGNvbnRhaW5lZCBjaHVuayBvZiB0aGUgd3JvbmcgdHlwZVwiKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGV4dC51cGRhdGUoY2h1bmtCeXRlcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRleHQuZGlnZXN0QW5kRHJvcChhbGdvcml0aG0ubGVuZ3RoKS5idWZmZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiZGF0YSBtdXN0IGJlIGEgQnVmZmVyU291cmNlIG9yIEl0ZXJhYmxlPEJ1ZmZlclNvdXJjZT5cIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9LFxuICB9LFxufSk7XG5cbmNvbnN0IEZOVkFsZ29yaXRobXMgPSBbXCJGTlYzMlwiLCBcIkZOVjMyQVwiLCBcIkZOVjY0XCIsIFwiRk5WNjRBXCJdO1xuXG4vKiogRGlnZXN0IGFsZ29yaXRobXMgc3VwcG9ydGVkIGJ5IFdlYkNyeXB0by4gKi9cbmNvbnN0IHdlYkNyeXB0b0RpZ2VzdEFsZ29yaXRobXMgPSBbXG4gIFwiU0hBLTM4NFwiLFxuICBcIlNIQS0yNTZcIixcbiAgXCJTSEEtNTEyXCIsXG4gIC8vIGluc2VjdXJlIChsZW5ndGgtZXh0ZW5kYWJsZSBhbmQgY29sbGlkYWJsZSk6XG4gIFwiU0hBLTFcIixcbl0gYXMgY29uc3Q7XG5cbnR5cGUgRk5WQWxnb3JpdGhtcyA9IFwiRk5WMzJcIiB8IFwiRk5WMzJBXCIgfCBcIkZOVjY0XCIgfCBcIkZOVjY0QVwiO1xudHlwZSBEaWdlc3RBbGdvcml0aG1OYW1lID0gV2FzbURpZ2VzdEFsZ29yaXRobSB8IEZOVkFsZ29yaXRobXM7XG5cbnR5cGUgRGlnZXN0QWxnb3JpdGhtT2JqZWN0ID0ge1xuICBuYW1lOiBEaWdlc3RBbGdvcml0aG1OYW1lO1xuICBsZW5ndGg/OiBudW1iZXI7XG59O1xuXG50eXBlIERpZ2VzdEFsZ29yaXRobSA9IERpZ2VzdEFsZ29yaXRobU5hbWUgfCBEaWdlc3RBbGdvcml0aG1PYmplY3Q7XG5cbmNvbnN0IG5vcm1hbGl6ZUFsZ29yaXRobSA9IChhbGdvcml0aG06IERpZ2VzdEFsZ29yaXRobSkgPT5cbiAgKCh0eXBlb2YgYWxnb3JpdGhtID09PSBcInN0cmluZ1wiKSA/IHsgbmFtZTogYWxnb3JpdGhtLnRvVXBwZXJDYXNlKCkgfSA6IHtcbiAgICAuLi5hbGdvcml0aG0sXG4gICAgbmFtZTogYWxnb3JpdGhtLm5hbWUudG9VcHBlckNhc2UoKSxcbiAgfSkgYXMgRGlnZXN0QWxnb3JpdGhtT2JqZWN0O1xuXG5leHBvcnQgeyBzdGRDcnlwdG8gYXMgY3J5cHRvIH07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLFNBRUUsb0JBQW9CLG9CQUFvQixFQUN4QyxlQUFlLFFBQ1YseUJBQXlCO0FBRWhDLFNBQVMsR0FBRyxRQUFRLGtCQUFrQjtBQUV0Qzs7OztDQUlDLEdBQ0QsTUFBTSxZQUFZLEFBQUMsQ0FBQSxDQUFDLFNBQVcsQ0FBQztJQUM5QixpQkFBaUIsT0FBTyxlQUFlLEVBQUUsS0FBSztJQUM5QyxZQUFZLE9BQU8sVUFBVSxFQUFFLEtBQUs7SUFDcEMsUUFBUTtNQUNOLFNBQVMsT0FBTyxNQUFNLEVBQUUsU0FBUyxLQUFLLE9BQU8sTUFBTTtNQUNuRCxZQUFZLE9BQU8sTUFBTSxFQUFFLFlBQVksS0FBSyxPQUFPLE1BQU07TUFDekQsV0FBVyxPQUFPLE1BQU0sRUFBRSxXQUFXLEtBQUssT0FBTyxNQUFNO01BQ3ZELFFBQVEsT0FBTyxNQUFN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