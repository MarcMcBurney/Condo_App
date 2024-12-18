// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
/**
 * Read big endian 16bit short from BufReader
 * @param buf
 */ export async function readShort(buf) {
  const high = await buf.readByte();
  if (high === null) return null;
  const low = await buf.readByte();
  if (low === null) throw new Deno.errors.UnexpectedEof();
  return high << 8 | low;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2lvL3JlYWRfc2hvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgdHlwZSBCdWZSZWFkZXIgfSBmcm9tIFwiLi9idWZfcmVhZGVyLnRzXCI7XG5cbi8qKlxuICogUmVhZCBiaWcgZW5kaWFuIDE2Yml0IHNob3J0IGZyb20gQnVmUmVhZGVyXG4gKiBAcGFyYW0gYnVmXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWFkU2hvcnQoYnVmOiBCdWZSZWFkZXIpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgY29uc3QgaGlnaCA9IGF3YWl0IGJ1Zi5yZWFkQnl0ZSgpO1xuICBpZiAoaGlnaCA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGxvdyA9IGF3YWl0IGJ1Zi5yZWFkQnl0ZSgpO1xuICBpZiAobG93ID09PSBudWxsKSB0aHJvdyBuZXcgRGVuby5lcnJvcnMuVW5leHBlY3RlZEVvZigpO1xuICByZXR1cm4gKGhpZ2ggPDwgOCkgfCBsb3c7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBSTFFOzs7Q0FHQyxHQUNELE9BQU8sZUFBZSxVQUFVLEdBQWM7RUFDNUMsTUFBTSxPQUFPLE1BQU0sSUFBSSxRQUFRO0VBQy9CLElBQUksU0FBUyxNQUFNLE9BQU87RUFDMUIsTUFBTSxNQUFNLE1BQU0sSUFBSSxRQUFRO0VBQzlCLElBQUksUUFBUSxNQUFNLE1BQU0sSUFBSSxLQUFLLE1BQU0sQ0FBQyxhQUFhO0VBQ3JELE9BQU8sQUFBQyxRQUFRLElBQUs7QUFDdkIifQ==