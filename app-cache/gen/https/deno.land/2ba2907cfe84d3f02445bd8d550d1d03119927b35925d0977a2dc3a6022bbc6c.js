// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { BytesList } from "../bytes/bytes_list.ts";
/** Generate longest proper prefix which is also suffix array. */ function createLPS(pat) {
  const lps = new Uint8Array(pat.length);
  lps[0] = 0;
  let prefixEnd = 0;
  let i = 1;
  while(i < lps.length){
    if (pat[i] == pat[prefixEnd]) {
      prefixEnd++;
      lps[i] = prefixEnd;
      i++;
    } else if (prefixEnd === 0) {
      lps[i] = 0;
      i++;
    } else {
      prefixEnd = lps[prefixEnd - 1];
    }
  }
  return lps;
}
/** Read delimited bytes from a Reader. */ export async function* readDelim(reader, delim) {
  // Avoid unicode problems
  const delimLen = delim.length;
  const delimLPS = createLPS(delim);
  const chunks = new BytesList();
  const bufSize = Math.max(1024, delimLen + 1);
  // Modified KMP
  let inspectIndex = 0;
  let matchIndex = 0;
  while(true){
    const inspectArr = new Uint8Array(bufSize);
    const result = await reader.read(inspectArr);
    if (result === null) {
      // Yield last chunk.
      yield chunks.concat();
      return;
    } else if (result < 0) {
      // Discard all remaining and silently fail.
      return;
    }
    chunks.add(inspectArr, 0, result);
    let localIndex = 0;
    while(inspectIndex < chunks.size()){
      if (inspectArr[localIndex] === delim[matchIndex]) {
        inspectIndex++;
        localIndex++;
        matchIndex++;
        if (matchIndex === delimLen) {
          // Full match
          const matchEnd = inspectIndex - delimLen;
          const readyBytes = chunks.slice(0, matchEnd);
          yield readyBytes;
          // Reset match, different from KMP.
          chunks.shift(inspectIndex);
          inspectIndex = 0;
          matchIndex = 0;
        }
      } else {
        if (matchIndex === 0) {
          inspectIndex++;
          localIndex++;
        } else {
          matchIndex = delimLPS[matchIndex - 1];
        }
      }
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2lvL3JlYWRfZGVsaW0udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuaW1wb3J0IHsgQnl0ZXNMaXN0IH0gZnJvbSBcIi4uL2J5dGVzL2J5dGVzX2xpc3QudHNcIjtcbmltcG9ydCB0eXBlIHsgUmVhZGVyIH0gZnJvbSBcIi4uL3R5cGVzLmQudHNcIjtcblxuLyoqIEdlbmVyYXRlIGxvbmdlc3QgcHJvcGVyIHByZWZpeCB3aGljaCBpcyBhbHNvIHN1ZmZpeCBhcnJheS4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUxQUyhwYXQ6IFVpbnQ4QXJyYXkpOiBVaW50OEFycmF5IHtcbiAgY29uc3QgbHBzID0gbmV3IFVpbnQ4QXJyYXkocGF0Lmxlbmd0aCk7XG4gIGxwc1swXSA9IDA7XG4gIGxldCBwcmVmaXhFbmQgPSAwO1xuICBsZXQgaSA9IDE7XG4gIHdoaWxlIChpIDwgbHBzLmxlbmd0aCkge1xuICAgIGlmIChwYXRbaV0gPT0gcGF0W3ByZWZpeEVuZF0pIHtcbiAgICAgIHByZWZpeEVuZCsrO1xuICAgICAgbHBzW2ldID0gcHJlZml4RW5kO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAocHJlZml4RW5kID09PSAwKSB7XG4gICAgICBscHNbaV0gPSAwO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcmVmaXhFbmQgPSBscHNbcHJlZml4RW5kIC0gMV07XG4gICAgfVxuICB9XG4gIHJldHVybiBscHM7XG59XG5cbi8qKiBSZWFkIGRlbGltaXRlZCBieXRlcyBmcm9tIGEgUmVhZGVyLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiByZWFkRGVsaW0oXG4gIHJlYWRlcjogUmVhZGVyLFxuICBkZWxpbTogVWludDhBcnJheSxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxVaW50OEFycmF5PiB7XG4gIC8vIEF2b2lkIHVuaWNvZGUgcHJvYmxlbXNcbiAgY29uc3QgZGVsaW1MZW4gPSBkZWxpbS5sZW5ndGg7XG4gIGNvbnN0IGRlbGltTFBTID0gY3JlYXRlTFBTKGRlbGltKTtcbiAgY29uc3QgY2h1bmtzID0gbmV3IEJ5dGVzTGlzdCgpO1xuICBjb25zdCBidWZTaXplID0gTWF0aC5tYXgoMTAyNCwgZGVsaW1MZW4gKyAxKTtcblxuICAvLyBNb2RpZmllZCBLTVBcbiAgbGV0IGluc3BlY3RJbmRleCA9IDA7XG4gIGxldCBtYXRjaEluZGV4ID0gMDtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBpbnNwZWN0QXJyID0gbmV3IFVpbnQ4QXJyYXkoYnVmU2l6ZSk7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVhZGVyLnJlYWQoaW5zcGVjdEFycik7XG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkge1xuICAgICAgLy8gWWllbGQgbGFzdCBjaHVuay5cbiAgICAgIHlpZWxkIGNodW5rcy5jb25jYXQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGVsc2UgaWYgKHJlc3VsdCA8IDApIHtcbiAgICAgIC8vIERpc2NhcmQgYWxsIHJlbWFpbmluZyBhbmQgc2lsZW50bHkgZmFpbC5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2h1bmtzLmFkZChpbnNwZWN0QXJyLCAwLCByZXN1bHQpO1xuICAgIGxldCBsb2NhbEluZGV4ID0gMDtcbiAgICB3aGlsZSAoaW5zcGVjdEluZGV4IDwgY2h1bmtzLnNpemUoKSkge1xuICAgICAgaWYgKGluc3BlY3RBcnJbbG9jYWxJbmRleF0gPT09IGRlbGltW21hdGNoSW5kZXhdKSB7XG4gICAgICAgIGluc3BlY3RJbmRleCsrO1xuICAgICAgICBsb2NhbEluZGV4Kys7XG4gICAgICAgIG1hdGNoSW5kZXgrKztcbiAgICAgICAgaWYgKG1hdGNoSW5kZXggPT09IGRlbGltTGVuKSB7XG4gICAgICAgICAgLy8gRnVsbCBtYXRjaFxuICAgICAgICAgIGNvbnN0IG1hdGNoRW5kID0gaW5zcGVjdEluZGV4IC0gZGVsaW1MZW47XG4gICAgICAgICAgY29uc3QgcmVhZHlCeXRlcyA9IGNodW5rcy5zbGljZSgwLCBtYXRjaEVuZCk7XG4gICAgICAgICAgeWllbGQgcmVhZHlCeXRlcztcbiAgICAgICAgICAvLyBSZXNldCBtYXRjaCwgZGlmZmVyZW50IGZyb20gS01QLlxuICAgICAgICAgIGNodW5rcy5zaGlmdChpbnNwZWN0SW5kZXgpO1xuICAgICAgICAgIGluc3BlY3RJbmRleCA9IDA7XG4gICAgICAgICAgbWF0Y2hJbmRleCA9IDA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChtYXRjaEluZGV4ID09PSAwKSB7XG4gICAgICAgICAgaW5zcGVjdEluZGV4Kys7XG4gICAgICAgICAgbG9jYWxJbmRleCsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1hdGNoSW5kZXggPSBkZWxpbUxQU1ttYXRjaEluZGV4IC0gMV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLFNBQVMsU0FBUyxRQUFRLHlCQUF5QjtBQUduRCwrREFBK0QsR0FDL0QsU0FBUyxVQUFVLEdBQWU7RUFDaEMsTUFBTSxNQUFNLElBQUksV0FBVyxJQUFJLE1BQU07RUFDckMsR0FBRyxDQUFDLEVBQUUsR0FBRztFQUNULElBQUksWUFBWTtFQUNoQixJQUFJLElBQUk7RUFDUixNQUFPLElBQUksSUFBSSxNQUFNLENBQUU7SUFDckIsSUFBSSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUU7TUFDNUI7TUFDQSxHQUFHLENBQUMsRUFBRSxHQUFHO01BQ1Q7SUFDRixPQUFPLElBQUksY0FBYyxHQUFHO01BQzFCLEdBQUcsQ0FBQyxFQUFFLEdBQUc7TUFDVDtJQUNGLE9BQU87TUFDTCxZQUFZLEdBQUcsQ0FBQyxZQUFZLEVBQUU7SUFDaEM7RUFDRjtFQUNBLE9BQU87QUFDVDtBQUVBLHdDQUF3QyxHQUN4QyxPQUFPLGdCQUFnQixVQUNyQixNQUFjLEVBQ2QsS0FBaUI7RUFFakIseUJBQXlCO0VBQ3pCLE1BQU0sV0FBVyxNQUFNLE1BQU07RUFDN0IsTUFBTSxXQUFXLFVBQVU7RUFDM0IsTUFBTSxTQUFTLElBQUk7RUFDbkIsTUFBTSxVQUFVLEtBQUssR0FBRyxDQUFDLE1BQU0sV0FBVztFQUUxQyxlQUFlO0VBQ2YsSUFBSSxlQUFlO0VBQ25CLElBQUksYUFBYTtFQUNqQixNQUFPLEtBQU07SUFDWCxNQUFNLGFBQWEsSUFBSSxXQUFXO0lBQ2xDLE1BQU0sU0FBUyxNQUFNLE9BQU8sSUFBSSxDQUFDO0lBQ2pDLElBQUksV0FBVyxNQUFNO01BQ25CLG9CQUFvQjtNQUNwQixNQUFNLE9BQU8sTUFBTTtNQUNuQjtJQUNGLE9BQU8sSUFBSSxTQUFTLEdBQUc7TUFDckIsMkNBQTJDO01BQzNDO0lBQ0Y7SUFDQSxPQUFPLEdBQUcsQ0FBQyxZQUFZLEdBQUc7SUFDMUIsSUFBSSxhQUFhO0lBQ2pCLE1BQU8sZUFBZSxPQUFPLElBQUksR0FBSTtNQUNuQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEtBQUssS0FBSyxDQUFDLFdBQVcsRUFBRTtRQUNoRDtRQUNBO1FBQ0E7UUFDQSxJQUFJLGVBQWUsVUFBVTtVQUMzQixhQUFhO1VBQ2IsTUFBTSxXQUFXLGVBQWU7VUFDaEMsTUFBTSxhQUFhLE9BQU8sS0FBSyxDQUFDLEdBQUc7VUFDbkMsTUFBTTtVQUNOLG1DQUFtQztVQUNuQyxPQUFPLEtBQUssQ0FBQztVQUNiLGVBQWU7VUFDZixhQUFhO1FBQ2Y7TUFDRixPQUFPO1FBQ0wsSUFBSSxlQUFlLEdBQUc7VUFDcEI7VUFDQTtRQUNGLE9BQU87VUFDTCxhQUFhLFFBQVEsQ0FBQyxhQUFhLEVBQUU7UUFDdkM7TUFDRjtJQUNGO0VBQ0Y7QUFDRiJ9