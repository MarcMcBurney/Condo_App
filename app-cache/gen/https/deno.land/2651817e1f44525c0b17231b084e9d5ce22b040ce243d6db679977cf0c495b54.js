// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
import { copy as copyBytes } from "../bytes/copy.ts";
import { assert } from "../assert/assert.ts";
const DEFAULT_BUFFER_SIZE = 32 * 1024;
/**
 * Read a range of bytes from a file or other resource that is readable and
 * seekable.  The range start and end are inclusive of the bytes within that
 * range.
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/assert/assert_equals.ts";
 * import { readRange } from "https://deno.land/std@$STD_VERSION/io/read_range.ts";
 *
 * // Read the first 10 bytes of a file
 * const file = await Deno.open("example.txt", { read: true });
 * const bytes = await readRange(file, { start: 0, end: 9 });
 * assertEquals(bytes.length, 10);
 * ```
 */ export async function readRange(r, range) {
  // byte ranges are inclusive, so we have to add one to the end
  let length = range.end - range.start + 1;
  assert(length > 0, "Invalid byte range was passed.");
  await r.seek(range.start, Deno.SeekMode.Start);
  const result = new Uint8Array(length);
  let off = 0;
  while(length){
    const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
    const nread = await r.read(p);
    assert(nread !== null, "Unexpected EOF reach while reading a range.");
    assert(nread > 0, "Unexpected read of 0 bytes while reading a range.");
    copyBytes(p, result, off);
    off += nread;
    length -= nread;
    assert(length >= 0, "Unexpected length remaining after reading range.");
  }
  return result;
}
/**
 * Read a range of bytes synchronously from a file or other resource that is
 * readable and seekable.  The range start and end are inclusive of the bytes
 * within that range.
 *
 * ```ts
 * import { assertEquals } from "https://deno.land/std@$STD_VERSION/assert/assert_equals.ts";
 * import { readRangeSync } from "https://deno.land/std@$STD_VERSION/io/read_range.ts";
 *
 * // Read the first 10 bytes of a file
 * const file = Deno.openSync("example.txt", { read: true });
 * const bytes = readRangeSync(file, { start: 0, end: 9 });
 * assertEquals(bytes.length, 10);
 * ```
 */ export function readRangeSync(r, range) {
  // byte ranges are inclusive, so we have to add one to the end
  let length = range.end - range.start + 1;
  assert(length > 0, "Invalid byte range was passed.");
  r.seekSync(range.start, Deno.SeekMode.Start);
  const result = new Uint8Array(length);
  let off = 0;
  while(length){
    const p = new Uint8Array(Math.min(length, DEFAULT_BUFFER_SIZE));
    const nread = r.readSync(p);
    assert(nread !== null, "Unexpected EOF reach while reading a range.");
    assert(nread > 0, "Unexpected read of 0 bytes while reading a range.");
    copyBytes(p, result, off);
    off += nread;
    length -= nread;
    assert(length >= 0, "Unexpected length remaining after reading range.");
  }
  return result;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2lvL3JlYWRfcmFuZ2UudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgY29weSBhcyBjb3B5Qnl0ZXMgfSBmcm9tIFwiLi4vYnl0ZXMvY29weS50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcIi4uL2Fzc2VydC9hc3NlcnQudHNcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGVyLCBSZWFkZXJTeW5jIH0gZnJvbSBcIi4uL3R5cGVzLmQudHNcIjtcblxuY29uc3QgREVGQVVMVF9CVUZGRVJfU0laRSA9IDMyICogMTAyNDtcblxuZXhwb3J0IGludGVyZmFjZSBCeXRlUmFuZ2Uge1xuICAvKiogVGhlIDAgYmFzZWQgaW5kZXggb2YgdGhlIHN0YXJ0IGJ5dGUgZm9yIGEgcmFuZ2UuICovXG4gIHN0YXJ0OiBudW1iZXI7XG5cbiAgLyoqIFRoZSAwIGJhc2VkIGluZGV4IG9mIHRoZSBlbmQgYnl0ZSBmb3IgYSByYW5nZSwgd2hpY2ggaXMgaW5jbHVzaXZlLiAqL1xuICBlbmQ6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBSZWFkIGEgcmFuZ2Ugb2YgYnl0ZXMgZnJvbSBhIGZpbGUgb3Igb3RoZXIgcmVzb3VyY2UgdGhhdCBpcyByZWFkYWJsZSBhbmRcbiAqIHNlZWthYmxlLiAgVGhlIHJhbmdlIHN0YXJ0IGFuZCBlbmQgYXJlIGluY2x1c2l2ZSBvZiB0aGUgYnl0ZXMgd2l0aGluIHRoYXRcbiAqIHJhbmdlLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBhc3NlcnRFcXVhbHMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9hc3NlcnQvYXNzZXJ0X2VxdWFscy50c1wiO1xuICogaW1wb3J0IHsgcmVhZFJhbmdlIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaW8vcmVhZF9yYW5nZS50c1wiO1xuICpcbiAqIC8vIFJlYWQgdGhlIGZpcnN0IDEwIGJ5dGVzIG9mIGEgZmlsZVxuICogY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3BlbihcImV4YW1wbGUudHh0XCIsIHsgcmVhZDogdHJ1ZSB9KTtcbiAqIGNvbnN0IGJ5dGVzID0gYXdhaXQgcmVhZFJhbmdlKGZpbGUsIHsgc3RhcnQ6IDAsIGVuZDogOSB9KTtcbiAqIGFzc2VydEVxdWFscyhieXRlcy5sZW5ndGgsIDEwKTtcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVhZFJhbmdlKFxuICByOiBSZWFkZXIgJiBEZW5vLlNlZWtlcixcbiAgcmFuZ2U6IEJ5dGVSYW5nZSxcbik6IFByb21pc2U8VWludDhBcnJheT4ge1xuICAvLyBieXRlIHJhbmdlcyBhcmUgaW5jbHVzaXZlLCBzbyB3ZSBoYXZlIHRvIGFkZCBvbmUgdG8gdGhlIGVuZFxuICBsZXQgbGVuZ3RoID0gcmFuZ2UuZW5kIC0gcmFuZ2Uuc3RhcnQgKyAxO1xuICBhc3NlcnQobGVuZ3RoID4gMCwgXCJJbnZhbGlkIGJ5dGUgcmFuZ2Ugd2FzIHBhc3NlZC5cIik7XG4gIGF3YWl0IHIuc2VlayhyYW5nZS5zdGFydCwgRGVuby5TZWVrTW9kZS5TdGFydCk7XG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG4gIGxldCBvZmYgPSAwO1xuICB3aGlsZSAobGVuZ3RoKSB7XG4gICAgY29uc3QgcCA9IG5ldyBVaW50OEFycmF5KE1hdGgubWluKGxlbmd0aCwgREVGQVVMVF9CVUZGRVJfU0laRSkpO1xuICAgIGNvbnN0IG5yZWFkID0gYXdhaXQgci5yZWFkKHApO1xuICAgIGFzc2VydChucmVhZCAhPT0gbnVsbCwgXCJVbmV4cGVjdGVkIEVPRiByZWFjaCB3aGlsZSByZWFkaW5nIGEgcmFuZ2UuXCIpO1xuICAgIGFzc2VydChucmVhZCA+IDAsIFwiVW5leHBlY3RlZCByZWFkIG9mIDAgYnl0ZXMgd2hpbGUgcmVhZGluZyBhIHJhbmdlLlwiKTtcbiAgICBjb3B5Qnl0ZXMocCwgcmVzdWx0LCBvZmYpO1xuICAgIG9mZiArPSBucmVhZDtcbiAgICBsZW5ndGggLT0gbnJlYWQ7XG4gICAgYXNzZXJ0KGxlbmd0aCA+PSAwLCBcIlVuZXhwZWN0ZWQgbGVuZ3RoIHJlbWFpbmluZyBhZnRlciByZWFkaW5nIHJhbmdlLlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFJlYWQgYSByYW5nZSBvZiBieXRlcyBzeW5jaHJvbm91c2x5IGZyb20gYSBmaWxlIG9yIG90aGVyIHJlc291cmNlIHRoYXQgaXNcbiAqIHJlYWRhYmxlIGFuZCBzZWVrYWJsZS4gIFRoZSByYW5nZSBzdGFydCBhbmQgZW5kIGFyZSBpbmNsdXNpdmUgb2YgdGhlIGJ5dGVzXG4gKiB3aXRoaW4gdGhhdCByYW5nZS5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgYXNzZXJ0RXF1YWxzIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vYXNzZXJ0L2Fzc2VydF9lcXVhbHMudHNcIjtcbiAqIGltcG9ydCB7IHJlYWRSYW5nZVN5bmMgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9pby9yZWFkX3JhbmdlLnRzXCI7XG4gKlxuICogLy8gUmVhZCB0aGUgZmlyc3QgMTAgYnl0ZXMgb2YgYSBmaWxlXG4gKiBjb25zdCBmaWxlID0gRGVuby5vcGVuU3luYyhcImV4YW1wbGUudHh0XCIsIHsgcmVhZDogdHJ1ZSB9KTtcbiAqIGNvbnN0IGJ5dGVzID0gcmVhZFJhbmdlU3luYyhmaWxlLCB7IHN0YXJ0OiAwLCBlbmQ6IDkgfSk7XG4gKiBhc3NlcnRFcXVhbHMoYnl0ZXMubGVuZ3RoLCAxMCk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRSYW5nZVN5bmMoXG4gIHI6IFJlYWRlclN5bmMgJiBEZW5vLlNlZWtlclN5bmMsXG4gIHJhbmdlOiBCeXRlUmFuZ2UsXG4pOiBVaW50OEFycmF5IHtcbiAgLy8gYnl0ZSByYW5nZXMgYXJlIGluY2x1c2l2ZSwgc28gd2UgaGF2ZSB0byBhZGQgb25lIHRvIHRoZSBlbmRcbiAgbGV0IGxlbmd0aCA9IHJhbmdlLmVuZCAtIHJhbmdlLnN0YXJ0ICsgMTtcbiAgYXNzZXJ0KGxlbmd0aCA+IDAsIFwiSW52YWxpZCBieXRlIHJhbmdlIHdhcyBwYXNzZWQuXCIpO1xuICByLnNlZWtTeW5jKHJhbmdlLnN0YXJ0LCBEZW5vLlNlZWtNb2RlLlN0YXJ0KTtcbiAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgbGV0IG9mZiA9IDA7XG4gIHdoaWxlIChsZW5ndGgpIHtcbiAgICBjb25zdCBwID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5taW4obGVuZ3RoLCBERUZBVUxUX0JVRkZFUl9TSVpFKSk7XG4gICAgY29uc3QgbnJlYWQgPSByLnJlYWRTeW5jKHApO1xuICAgIGFzc2VydChucmVhZCAhPT0gbnVsbCwgXCJVbmV4cGVjdGVkIEVPRiByZWFjaCB3aGlsZSByZWFkaW5nIGEgcmFuZ2UuXCIpO1xuICAgIGFzc2VydChucmVhZCA+IDAsIFwiVW5leHBlY3RlZCByZWFkIG9mIDAgYnl0ZXMgd2hpbGUgcmVhZGluZyBhIHJhbmdlLlwiKTtcbiAgICBjb3B5Qnl0ZXMocCwgcmVzdWx0LCBvZmYpO1xuICAgIG9mZiArPSBucmVhZDtcbiAgICBsZW5ndGggLT0gbnJlYWQ7XG4gICAgYXNzZXJ0KGxlbmd0aCA+PSAwLCBcIlVuZXhwZWN0ZWQgbGVuZ3RoIHJlbWFpbmluZyBhZnRlciByZWFkaW5nIHJhbmdlLlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUUxRSxTQUFTLFFBQVEsU0FBUyxRQUFRLG1CQUFtQjtBQUNyRCxTQUFTLE1BQU0sUUFBUSxzQkFBc0I7QUFHN0MsTUFBTSxzQkFBc0IsS0FBSztBQVVqQzs7Ozs7Ozs7Ozs7Ozs7Q0FjQyxHQUNELE9BQU8sZUFBZSxVQUNwQixDQUF1QixFQUN2QixLQUFnQjtFQUVoQiw4REFBOEQ7RUFDOUQsSUFBSSxTQUFTLE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxHQUFHO0VBQ3ZDLE9BQU8sU0FBUyxHQUFHO0VBQ25CLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLEVBQUUsS0FBSyxRQUFRLENBQUMsS0FBSztFQUM3QyxNQUFNLFNBQVMsSUFBSSxXQUFXO0VBQzlCLElBQUksTUFBTTtFQUNWLE1BQU8sT0FBUTtJQUNiLE1BQU0sSUFBSSxJQUFJLFdBQVcsS0FBSyxHQUFHLENBQUMsUUFBUTtJQUMxQyxNQUFNLFFBQVEsTUFBTSxFQUFFLElBQUksQ0FBQztJQUMzQixPQUFPLFVBQVUsTUFBTTtJQUN2QixPQUFPLFFBQVEsR0FBRztJQUNsQixVQUFVLEdBQUcsUUFBUTtJQUNyQixPQUFPO0lBQ1AsVUFBVTtJQUNWLE9BQU8sVUFBVSxHQUFHO0VBQ3RCO0VBQ0EsT0FBTztBQUNUO0FBRUE7Ozs7Ozs7Ozs7Ozs7O0NBY0MsR0FDRCxPQUFPLFNBQVMsY0FDZCxDQUErQixFQUMvQixLQUFnQjtFQUVoQiw4REFBOEQ7RUFDOUQsSUFBSSxTQUFTLE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxHQUFHO0VBQ3ZDLE9BQU8sU0FBUyxHQUFHO0VBQ25CLEVBQUUsUUFBUSxDQUFDLE1BQU0sS0FBSyxFQUFFLEtBQUssUUFBUSxDQUFDLEtBQUs7RUFDM0MsTUFBTSxTQUFTLElBQUksV0FBVztFQUM5QixJQUFJLE1BQU07RUFDVixNQUFPLE9BQVE7SUFDYixNQUFNLElBQUksSUFBSSxXQUFXLEtBQUssR0FBRyxDQUFDLFFBQVE7SUFDMUMsTUFBTSxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQ3pCLE9BQU8sVUFBVSxNQUFNO0lBQ3ZCLE9BQU8sUUFBUSxHQUFHO0lBQ2xCLFVBQVUsR0FBRyxRQUFRO0lBQ3JCLE9BQU87SUFDUCxVQUFVO0lBQ1YsT0FBTyxVQUFVLEdBQUc7RUFDdEI7RUFDQSxPQUFPO0FBQ1QifQ==