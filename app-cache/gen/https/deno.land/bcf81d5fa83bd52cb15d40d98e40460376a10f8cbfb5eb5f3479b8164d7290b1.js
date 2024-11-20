// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { assert } from "../assert/assert.ts";
import { copy } from "../bytes/copy.ts";
const MAX_SIZE = 2 ** 32 - 2;
const DEFAULT_CHUNK_SIZE = 16_640;
/** A variable-sized buffer of bytes with `read()` and `write()` methods.
 *
 * Buffer is almost always used with some I/O like files and sockets. It allows
 * one to buffer up a download from a socket. Buffer grows and shrinks as
 * necessary.
 *
 * Buffer is NOT the same thing as Node's Buffer. Node's Buffer was created in
 * 2009 before JavaScript had the concept of ArrayBuffers. It's simply a
 * non-standard ArrayBuffer.
 *
 * ArrayBuffer is a fixed memory allocation. Buffer is implemented on top of
 * ArrayBuffer.
 *
 * Based on [Go Buffer](https://golang.org/pkg/bytes/#Buffer). */ export class Buffer {
  #buf;
  #off = 0;
  #readable = new ReadableStream({
    type: "bytes",
    pull: (controller)=>{
      const view = new Uint8Array(controller.byobRequest.view.buffer);
      if (this.empty()) {
        // Buffer is empty, reset to recover space.
        this.reset();
        controller.close();
        controller.byobRequest.respond(0);
        return;
      }
      const nread = copy(this.#buf.subarray(this.#off), view);
      this.#off += nread;
      controller.byobRequest.respond(nread);
    },
    autoAllocateChunkSize: DEFAULT_CHUNK_SIZE
  });
  get readable() {
    return this.#readable;
  }
  #writable = new WritableStream({
    write: (chunk)=>{
      const m = this.#grow(chunk.byteLength);
      copy(chunk, this.#buf, m);
    }
  });
  get writable() {
    return this.#writable;
  }
  constructor(ab){
    this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
  }
  /** Returns a slice holding the unread portion of the buffer.
   *
   * The slice is valid for use only until the next buffer modification (that
   * is, only until the next call to a method like `read()`, `write()`,
   * `reset()`, or `truncate()`). If `options.copy` is false the slice aliases
   * the buffer content at least until the next buffer modification, so
   * immediate changes to the slice will affect the result of future reads.
   */ bytes(options = {
    copy: true
  }) {
    if (options.copy === false) return this.#buf.subarray(this.#off);
    return this.#buf.slice(this.#off);
  }
  /** Returns whether the unread portion of the buffer is empty. */ empty() {
    return this.#buf.byteLength <= this.#off;
  }
  /** A read only number of bytes of the unread portion of the buffer. */ get length() {
    return this.#buf.byteLength - this.#off;
  }
  /** The read only capacity of the buffer's underlying byte slice, that is,
   * the total space allocated for the buffer's data. */ get capacity() {
    return this.#buf.buffer.byteLength;
  }
  /** Discards all but the first `n` unread bytes from the buffer but
   * continues to use the same allocated storage. It throws if `n` is
   * negative or greater than the length of the buffer. */ truncate(n) {
    if (n === 0) {
      this.reset();
      return;
    }
    if (n < 0 || n > this.length) {
      throw Error("bytes.Buffer: truncation out of range");
    }
    this.#reslice(this.#off + n);
  }
  reset() {
    this.#reslice(0);
    this.#off = 0;
  }
  #tryGrowByReslice(n) {
    const l = this.#buf.byteLength;
    if (n <= this.capacity - l) {
      this.#reslice(l + n);
      return l;
    }
    return -1;
  }
  #reslice(len) {
    assert(len <= this.#buf.buffer.byteLength);
    this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
  }
  #grow(n) {
    const m = this.length;
    // If buffer is empty, reset to recover space.
    if (m === 0 && this.#off !== 0) {
      this.reset();
    }
    // Fast: Try to grow by means of a reslice.
    const i = this.#tryGrowByReslice(n);
    if (i >= 0) {
      return i;
    }
    const c = this.capacity;
    if (n <= Math.floor(c / 2) - m) {
      // We can slide things down instead of allocating a new
      // ArrayBuffer. We only need m+n <= c to slide, but
      // we instead let capacity get twice as large so we
      // don't spend all our time copying.
      copy(this.#buf.subarray(this.#off), this.#buf);
    } else if (c + n > MAX_SIZE) {
      throw new Error("The buffer cannot be grown beyond the maximum size.");
    } else {
      // Not enough space anywhere, we need to allocate.
      const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
      copy(this.#buf.subarray(this.#off), buf);
      this.#buf = buf;
    }
    // Restore this.#off and len(this.#buf).
    this.#off = 0;
    this.#reslice(Math.min(m + n, MAX_SIZE));
    return m;
  }
  /** Grows the buffer's capacity, if necessary, to guarantee space for
   * another `n` bytes. After `.grow(n)`, at least `n` bytes can be written to
   * the buffer without another allocation. If `n` is negative, `.grow()` will
   * throw. If the buffer can't grow it will throw an error.
   *
   * Based on Go Lang's
   * [Buffer.Grow](https://golang.org/pkg/bytes/#Buffer.Grow). */ grow(n) {
    if (n < 0) {
      throw Error("Buffer.grow: negative count");
    }
    const m = this.#grow(n);
    this.#reslice(m);
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3N0cmVhbXMvYnVmZmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjMgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9hc3NlcnQvYXNzZXJ0LnRzXCI7XG5pbXBvcnQgeyBjb3B5IH0gZnJvbSBcIi4uL2J5dGVzL2NvcHkudHNcIjtcblxuY29uc3QgTUFYX1NJWkUgPSAyICoqIDMyIC0gMjtcbmNvbnN0IERFRkFVTFRfQ0hVTktfU0laRSA9IDE2XzY0MDtcblxuLyoqIEEgdmFyaWFibGUtc2l6ZWQgYnVmZmVyIG9mIGJ5dGVzIHdpdGggYHJlYWQoKWAgYW5kIGB3cml0ZSgpYCBtZXRob2RzLlxuICpcbiAqIEJ1ZmZlciBpcyBhbG1vc3QgYWx3YXlzIHVzZWQgd2l0aCBzb21lIEkvTyBsaWtlIGZpbGVzIGFuZCBzb2NrZXRzLiBJdCBhbGxvd3NcbiAqIG9uZSB0byBidWZmZXIgdXAgYSBkb3dubG9hZCBmcm9tIGEgc29ja2V0LiBCdWZmZXIgZ3Jvd3MgYW5kIHNocmlua3MgYXNcbiAqIG5lY2Vzc2FyeS5cbiAqXG4gKiBCdWZmZXIgaXMgTk9UIHRoZSBzYW1lIHRoaW5nIGFzIE5vZGUncyBCdWZmZXIuIE5vZGUncyBCdWZmZXIgd2FzIGNyZWF0ZWQgaW5cbiAqIDIwMDkgYmVmb3JlIEphdmFTY3JpcHQgaGFkIHRoZSBjb25jZXB0IG9mIEFycmF5QnVmZmVycy4gSXQncyBzaW1wbHkgYVxuICogbm9uLXN0YW5kYXJkIEFycmF5QnVmZmVyLlxuICpcbiAqIEFycmF5QnVmZmVyIGlzIGEgZml4ZWQgbWVtb3J5IGFsbG9jYXRpb24uIEJ1ZmZlciBpcyBpbXBsZW1lbnRlZCBvbiB0b3Agb2ZcbiAqIEFycmF5QnVmZmVyLlxuICpcbiAqIEJhc2VkIG9uIFtHbyBCdWZmZXJdKGh0dHBzOi8vZ29sYW5nLm9yZy9wa2cvYnl0ZXMvI0J1ZmZlcikuICovXG5leHBvcnQgY2xhc3MgQnVmZmVyIHtcbiAgI2J1ZjogVWludDhBcnJheTsgLy8gY29udGVudHMgYXJlIHRoZSBieXRlcyBidWZbb2ZmIDogbGVuKGJ1ZildXG4gICNvZmYgPSAwOyAvLyByZWFkIGF0IGJ1ZltvZmZdLCB3cml0ZSBhdCBidWZbYnVmLmJ5dGVMZW5ndGhdXG4gICNyZWFkYWJsZTogUmVhZGFibGVTdHJlYW08VWludDhBcnJheT4gPSBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgIHR5cGU6IFwiYnl0ZXNcIixcbiAgICBwdWxsOiAoY29udHJvbGxlcikgPT4ge1xuICAgICAgY29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGNvbnRyb2xsZXIuYnlvYlJlcXVlc3QhLnZpZXchLmJ1ZmZlcik7XG4gICAgICBpZiAodGhpcy5lbXB0eSgpKSB7XG4gICAgICAgIC8vIEJ1ZmZlciBpcyBlbXB0eSwgcmVzZXQgdG8gcmVjb3ZlciBzcGFjZS5cbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgIGNvbnRyb2xsZXIuYnlvYlJlcXVlc3QhLnJlc3BvbmQoMCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5yZWFkID0gY29weSh0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jb2ZmKSwgdmlldyk7XG4gICAgICB0aGlzLiNvZmYgKz0gbnJlYWQ7XG4gICAgICBjb250cm9sbGVyLmJ5b2JSZXF1ZXN0IS5yZXNwb25kKG5yZWFkKTtcbiAgICB9LFxuICAgIGF1dG9BbGxvY2F0ZUNodW5rU2l6ZTogREVGQVVMVF9DSFVOS19TSVpFLFxuICB9KTtcbiAgZ2V0IHJlYWRhYmxlKCkge1xuICAgIHJldHVybiB0aGlzLiNyZWFkYWJsZTtcbiAgfVxuICAjd3JpdGFibGUgPSBuZXcgV3JpdGFibGVTdHJlYW08VWludDhBcnJheT4oe1xuICAgIHdyaXRlOiAoY2h1bmspID0+IHtcbiAgICAgIGNvbnN0IG0gPSB0aGlzLiNncm93KGNodW5rLmJ5dGVMZW5ndGgpO1xuICAgICAgY29weShjaHVuaywgdGhpcy4jYnVmLCBtKTtcbiAgICB9LFxuICB9KTtcbiAgZ2V0IHdyaXRhYmxlKCkge1xuICAgIHJldHVybiB0aGlzLiN3cml0YWJsZTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGFiPzogQXJyYXlCdWZmZXJMaWtlIHwgQXJyYXlMaWtlPG51bWJlcj4pIHtcbiAgICB0aGlzLiNidWYgPSBhYiA9PT0gdW5kZWZpbmVkID8gbmV3IFVpbnQ4QXJyYXkoMCkgOiBuZXcgVWludDhBcnJheShhYik7XG4gIH1cblxuICAvKiogUmV0dXJucyBhIHNsaWNlIGhvbGRpbmcgdGhlIHVucmVhZCBwb3J0aW9uIG9mIHRoZSBidWZmZXIuXG4gICAqXG4gICAqIFRoZSBzbGljZSBpcyB2YWxpZCBmb3IgdXNlIG9ubHkgdW50aWwgdGhlIG5leHQgYnVmZmVyIG1vZGlmaWNhdGlvbiAodGhhdFxuICAgKiBpcywgb25seSB1bnRpbCB0aGUgbmV4dCBjYWxsIHRvIGEgbWV0aG9kIGxpa2UgYHJlYWQoKWAsIGB3cml0ZSgpYCxcbiAgICogYHJlc2V0KClgLCBvciBgdHJ1bmNhdGUoKWApLiBJZiBgb3B0aW9ucy5jb3B5YCBpcyBmYWxzZSB0aGUgc2xpY2UgYWxpYXNlc1xuICAgKiB0aGUgYnVmZmVyIGNvbnRlbnQgYXQgbGVhc3QgdW50aWwgdGhlIG5leHQgYnVmZmVyIG1vZGlmaWNhdGlvbiwgc29cbiAgICogaW1tZWRpYXRlIGNoYW5nZXMgdG8gdGhlIHNsaWNlIHdpbGwgYWZmZWN0IHRoZSByZXN1bHQgb2YgZnV0dXJlIHJlYWRzLlxuICAgKi9cbiAgYnl0ZXMob3B0aW9ucyA9IHsgY29weTogdHJ1ZSB9KTogVWludDhBcnJheSB7XG4gICAgaWYgKG9wdGlvbnMuY29weSA9PT0gZmFsc2UpIHJldHVybiB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jb2ZmKTtcbiAgICByZXR1cm4gdGhpcy4jYnVmLnNsaWNlKHRoaXMuI29mZik7XG4gIH1cblxuICAvKiogUmV0dXJucyB3aGV0aGVyIHRoZSB1bnJlYWQgcG9ydGlvbiBvZiB0aGUgYnVmZmVyIGlzIGVtcHR5LiAqL1xuICBlbXB0eSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy4jYnVmLmJ5dGVMZW5ndGggPD0gdGhpcy4jb2ZmO1xuICB9XG5cbiAgLyoqIEEgcmVhZCBvbmx5IG51bWJlciBvZiBieXRlcyBvZiB0aGUgdW5yZWFkIHBvcnRpb24gb2YgdGhlIGJ1ZmZlci4gKi9cbiAgZ2V0IGxlbmd0aCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLiNidWYuYnl0ZUxlbmd0aCAtIHRoaXMuI29mZjtcbiAgfVxuXG4gIC8qKiBUaGUgcmVhZCBvbmx5IGNhcGFjaXR5IG9mIHRoZSBidWZmZXIncyB1bmRlcmx5aW5nIGJ5dGUgc2xpY2UsIHRoYXQgaXMsXG4gICAqIHRoZSB0b3RhbCBzcGFjZSBhbGxvY2F0ZWQgZm9yIHRoZSBidWZmZXIncyBkYXRhLiAqL1xuICBnZXQgY2FwYWNpdHkoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jYnVmLmJ1ZmZlci5ieXRlTGVuZ3RoO1xuICB9XG5cbiAgLyoqIERpc2NhcmRzIGFsbCBidXQgdGhlIGZpcnN0IGBuYCB1bnJlYWQgYnl0ZXMgZnJvbSB0aGUgYnVmZmVyIGJ1dFxuICAgKiBjb250aW51ZXMgdG8gdXNlIHRoZSBzYW1lIGFsbG9jYXRlZCBzdG9yYWdlLiBJdCB0aHJvd3MgaWYgYG5gIGlzXG4gICAqIG5lZ2F0aXZlIG9yIGdyZWF0ZXIgdGhhbiB0aGUgbGVuZ3RoIG9mIHRoZSBidWZmZXIuICovXG4gIHRydW5jYXRlKG46IG51bWJlcikge1xuICAgIGlmIChuID09PSAwKSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChuIDwgMCB8fCBuID4gdGhpcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKFwiYnl0ZXMuQnVmZmVyOiB0cnVuY2F0aW9uIG91dCBvZiByYW5nZVwiKTtcbiAgICB9XG4gICAgdGhpcy4jcmVzbGljZSh0aGlzLiNvZmYgKyBuKTtcbiAgfVxuXG4gIHJlc2V0KCkge1xuICAgIHRoaXMuI3Jlc2xpY2UoMCk7XG4gICAgdGhpcy4jb2ZmID0gMDtcbiAgfVxuXG4gICN0cnlHcm93QnlSZXNsaWNlKG46IG51bWJlcikge1xuICAgIGNvbnN0IGwgPSB0aGlzLiNidWYuYnl0ZUxlbmd0aDtcbiAgICBpZiAobiA8PSB0aGlzLmNhcGFjaXR5IC0gbCkge1xuICAgICAgdGhpcy4jcmVzbGljZShsICsgbik7XG4gICAgICByZXR1cm4gbDtcbiAgICB9XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgI3Jlc2xpY2UobGVuOiBudW1iZXIpIHtcbiAgICBhc3NlcnQobGVuIDw9IHRoaXMuI2J1Zi5idWZmZXIuYnl0ZUxlbmd0aCk7XG4gICAgdGhpcy4jYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy4jYnVmLmJ1ZmZlciwgMCwgbGVuKTtcbiAgfVxuXG4gICNncm93KG46IG51bWJlcikge1xuICAgIGNvbnN0IG0gPSB0aGlzLmxlbmd0aDtcbiAgICAvLyBJZiBidWZmZXIgaXMgZW1wdHksIHJlc2V0IHRvIHJlY292ZXIgc3BhY2UuXG4gICAgaWYgKG0gPT09IDAgJiYgdGhpcy4jb2ZmICE9PSAwKSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuICAgIC8vIEZhc3Q6IFRyeSB0byBncm93IGJ5IG1lYW5zIG9mIGEgcmVzbGljZS5cbiAgICBjb25zdCBpID0gdGhpcy4jdHJ5R3Jvd0J5UmVzbGljZShuKTtcbiAgICBpZiAoaSA+PSAwKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gICAgY29uc3QgYyA9IHRoaXMuY2FwYWNpdHk7XG4gICAgaWYgKG4gPD0gTWF0aC5mbG9vcihjIC8gMikgLSBtKSB7XG4gICAgICAvLyBXZSBjYW4gc2xpZGUgdGhpbmdzIGRvd24gaW5zdGVhZCBvZiBhbGxvY2F0aW5nIGEgbmV3XG4gICAgICAvLyBBcnJheUJ1ZmZlci4gV2Ugb25seSBuZWVkIG0rbiA8PSBjIHRvIHNsaWRlLCBidXRcbiAgICAgIC8vIHdlIGluc3RlYWQgbGV0IGNhcGFjaXR5IGdldCB0d2ljZSBhcyBsYXJnZSBzbyB3ZVxuICAgICAgLy8gZG9uJ3Qgc3BlbmQgYWxsIG91ciB0aW1lIGNvcHlpbmcuXG4gICAgICBjb3B5KHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNvZmYpLCB0aGlzLiNidWYpO1xuICAgIH0gZWxzZSBpZiAoYyArIG4gPiBNQVhfU0laRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGJ1ZmZlciBjYW5ub3QgYmUgZ3Jvd24gYmV5b25kIHRoZSBtYXhpbXVtIHNpemUuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgZW5vdWdoIHNwYWNlIGFueXdoZXJlLCB3ZSBuZWVkIHRvIGFsbG9jYXRlLlxuICAgICAgY29uc3QgYnVmID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5taW4oMiAqIGMgKyBuLCBNQVhfU0laRSkpO1xuICAgICAgY29weSh0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jb2ZmKSwgYnVmKTtcbiAgICAgIHRoaXMuI2J1ZiA9IGJ1ZjtcbiAgICB9XG4gICAgLy8gUmVzdG9yZSB0aGlzLiNvZmYgYW5kIGxlbih0aGlzLiNidWYpLlxuICAgIHRoaXMuI29mZiA9IDA7XG4gICAgdGhpcy4jcmVzbGljZShNYXRoLm1pbihtICsgbiwgTUFYX1NJWkUpKTtcbiAgICByZXR1cm4gbTtcbiAgfVxuXG4gIC8qKiBHcm93cyB0aGUgYnVmZmVyJ3MgY2FwYWNpdHksIGlmIG5lY2Vzc2FyeSwgdG8gZ3VhcmFudGVlIHNwYWNlIGZvclxuICAgKiBhbm90aGVyIGBuYCBieXRlcy4gQWZ0ZXIgYC5ncm93KG4pYCwgYXQgbGVhc3QgYG5gIGJ5dGVzIGNhbiBiZSB3cml0dGVuIHRvXG4gICAqIHRoZSBidWZmZXIgd2l0aG91dCBhbm90aGVyIGFsbG9jYXRpb24uIElmIGBuYCBpcyBuZWdhdGl2ZSwgYC5ncm93KClgIHdpbGxcbiAgICogdGhyb3cuIElmIHRoZSBidWZmZXIgY2FuJ3QgZ3JvdyBpdCB3aWxsIHRocm93IGFuIGVycm9yLlxuICAgKlxuICAgKiBCYXNlZCBvbiBHbyBMYW5nJ3NcbiAgICogW0J1ZmZlci5Hcm93XShodHRwczovL2dvbGFuZy5vcmcvcGtnL2J5dGVzLyNCdWZmZXIuR3JvdykuICovXG4gIGdyb3cobjogbnVtYmVyKSB7XG4gICAgaWYgKG4gPCAwKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIkJ1ZmZlci5ncm93OiBuZWdhdGl2ZSBjb3VudFwiKTtcbiAgICB9XG4gICAgY29uc3QgbSA9IHRoaXMuI2dyb3cobik7XG4gICAgdGhpcy4jcmVzbGljZShtKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsU0FBUyxNQUFNLFFBQVEsc0JBQXNCO0FBQzdDLFNBQVMsSUFBSSxRQUFRLG1CQUFtQjtBQUV4QyxNQUFNLFdBQVcsS0FBSyxLQUFLO0FBQzNCLE1BQU0scUJBQXFCO0FBRTNCOzs7Ozs7Ozs7Ozs7OytEQWErRCxHQUMvRCxPQUFPLE1BQU07RUFDWCxDQUFDLEdBQUcsQ0FBYTtFQUNqQixDQUFDLEdBQUcsR0FBRyxFQUFFO0VBQ1QsQ0FBQyxRQUFRLEdBQStCLElBQUksZUFBZTtJQUN6RCxNQUFNO0lBQ04sTUFBTSxDQUFDO01BQ0wsTUFBTSxPQUFPLElBQUksV0FBVyxXQUFXLFdBQVcsQ0FBRSxJQUFJLENBQUUsTUFBTTtNQUNoRSxJQUFJLElBQUksQ0FBQyxLQUFLLElBQUk7UUFDaEIsMkNBQTJDO1FBQzNDLElBQUksQ0FBQyxLQUFLO1FBQ1YsV0FBVyxLQUFLO1FBQ2hCLFdBQVcsV0FBVyxDQUFFLE9BQU8sQ0FBQztRQUNoQztNQUNGO01BQ0EsTUFBTSxRQUFRLEtBQUssSUFBSSxDQUFDLENBQUMsR0FBRyxD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