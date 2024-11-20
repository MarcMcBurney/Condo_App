// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { assert } from "../assert/assert.ts";
const DEFAULT_BUFFER_SIZE = 32 * 1024;
/**
 * Copy N size at the most. If read size is lesser than N, then returns nread
 * @param r Reader
 * @param dest Writer
 * @param size Read size
 */ export async function copyN(r, dest, size) {
  let bytesRead = 0;
  let buf = new Uint8Array(DEFAULT_BUFFER_SIZE);
  while(bytesRead < size){
    if (size - bytesRead < DEFAULT_BUFFER_SIZE) {
      buf = new Uint8Array(size - bytesRead);
    }
    const result = await r.read(buf);
    const nread = result ?? 0;
    bytesRead += nread;
    if (nread > 0) {
      let n = 0;
      while(n < nread){
        n += await dest.write(buf.slice(n, nread));
      }
      assert(n === nread, "could not write");
    }
    if (result === null) {
      break;
    }
  }
  return bytesRead;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2lvL2NvcHlfbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIzIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vYXNzZXJ0L2Fzc2VydC50c1wiO1xuaW1wb3J0IHR5cGUgeyBSZWFkZXIsIFdyaXRlciB9IGZyb20gXCIuLi90eXBlcy5kLnRzXCI7XG5cbmNvbnN0IERFRkFVTFRfQlVGRkVSX1NJWkUgPSAzMiAqIDEwMjQ7XG5cbi8qKlxuICogQ29weSBOIHNpemUgYXQgdGhlIG1vc3QuIElmIHJlYWQgc2l6ZSBpcyBsZXNzZXIgdGhhbiBOLCB0aGVuIHJldHVybnMgbnJlYWRcbiAqIEBwYXJhbSByIFJlYWRlclxuICogQHBhcmFtIGRlc3QgV3JpdGVyXG4gKiBAcGFyYW0gc2l6ZSBSZWFkIHNpemVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvcHlOKFxuICByOiBSZWFkZXIsXG4gIGRlc3Q6IFdyaXRlcixcbiAgc2l6ZTogbnVtYmVyLFxuKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgbGV0IGJ5dGVzUmVhZCA9IDA7XG4gIGxldCBidWYgPSBuZXcgVWludDhBcnJheShERUZBVUxUX0JVRkZFUl9TSVpFKTtcbiAgd2hpbGUgKGJ5dGVzUmVhZCA8IHNpemUpIHtcbiAgICBpZiAoc2l6ZSAtIGJ5dGVzUmVhZCA8IERFRkFVTFRfQlVGRkVSX1NJWkUpIHtcbiAgICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHNpemUgLSBieXRlc1JlYWQpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByLnJlYWQoYnVmKTtcbiAgICBjb25zdCBucmVhZCA9IHJlc3VsdCA/PyAwO1xuICAgIGJ5dGVzUmVhZCArPSBucmVhZDtcbiAgICBpZiAobnJlYWQgPiAwKSB7XG4gICAgICBsZXQgbiA9IDA7XG4gICAgICB3aGlsZSAobiA8IG5yZWFkKSB7XG4gICAgICAgIG4gKz0gYXdhaXQgZGVzdC53cml0ZShidWYuc2xpY2UobiwgbnJlYWQpKTtcbiAgICAgIH1cbiAgICAgIGFzc2VydChuID09PSBucmVhZCwgXCJjb3VsZCBub3Qgd3JpdGVcIik7XG4gICAgfVxuICAgIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gYnl0ZXNSZWFkO1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsU0FBUyxNQUFNLFFBQVEsc0JBQXNCO0FBRzdDLE1BQU0sc0JBQXNCLEtBQUs7QUFFakM7Ozs7O0NBS0MsR0FDRCxPQUFPLGVBQWUsTUFDcEIsQ0FBUyxFQUNULElBQVksRUFDWixJQUFZO0VBRVosSUFBSSxZQUFZO0VBQ2hCLElBQUksTUFBTSxJQUFJLFdBQVc7RUFDekIsTUFBTyxZQUFZLEtBQU07SUFDdkIsSUFBSSxPQUFPLFlBQVkscUJBQXFCO01BQzFDLE1BQU0sSUFBSSxXQUFXLE9BQU87SUFDOUI7SUFDQSxNQUFNLFNBQVMsTUFBTSxFQUFFLElBQUksQ0FBQztJQUM1QixNQUFNLFFBQVEsVUFBVTtJQUN4QixhQUFhO0lBQ2IsSUFBSSxRQUFRLEdBQUc7TUFDYixJQUFJLElBQUk7TUFDUixNQUFPLElBQUksTUFBTztRQUNoQixLQUFLLE1BQU0sS0FBSyxLQUFLLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRztNQUNyQztNQUNBLE9BQU8sTUFBTSxPQUFPO0lBQ3RCO0lBQ0EsSUFBSSxXQUFXLE1BQU07TUFDbkI7SUFDRjtFQUNGO0VBQ0EsT0FBTztBQUNUIn0=