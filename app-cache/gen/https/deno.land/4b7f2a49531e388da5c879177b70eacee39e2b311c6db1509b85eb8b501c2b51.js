import { random } from "./random.ts";
import { urlAlphabet } from "./urlAlphabet.ts";
export const nanoid = (size = 21)=>{
  let id = "";
  const bytes = random(size);
  // Compact alternative for `for (var i = 0; i < size; i++)`
  // We can’t use bytes bigger than the alphabet. 63 is 00111111 bitmask.
  // This mask reduces random byte 0-255 to 0-63 values.
  // There is no need in `|| ''` and `* 1.6` hacks in here,
  // because bitmask trim bytes exact to alphabet size.
  while(size--)id += urlAlphabet[bytes[size] & 63];
  return id;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvbmFub2lkQHYzLjAuMC9uYW5vaWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSBcIi4vcmFuZG9tLnRzXCI7XG5pbXBvcnQgeyB1cmxBbHBoYWJldCB9IGZyb20gXCIuL3VybEFscGhhYmV0LnRzXCI7XG5cbmV4cG9ydCBjb25zdCBuYW5vaWQgPSAoc2l6ZTogbnVtYmVyID0gMjEpOiBzdHJpbmcgPT4ge1xuICBsZXQgaWQ6IHN0cmluZyA9IFwiXCI7XG4gIGNvbnN0IGJ5dGVzOiBVaW50OEFycmF5ID0gcmFuZG9tKHNpemUpO1xuICAvLyBDb21wYWN0IGFsdGVybmF0aXZlIGZvciBgZm9yICh2YXIgaSA9IDA7IGkgPCBzaXplOyBpKyspYFxuICAvLyBXZSBjYW7igJl0IHVzZSBieXRlcyBiaWdnZXIgdGhhbiB0aGUgYWxwaGFiZXQuIDYzIGlzIDAwMTExMTExIGJpdG1hc2suXG4gIC8vIFRoaXMgbWFzayByZWR1Y2VzIHJhbmRvbSBieXRlIDAtMjU1IHRvIDAtNjMgdmFsdWVzLlxuICAvLyBUaGVyZSBpcyBubyBuZWVkIGluIGB8fCAnJ2AgYW5kIGAqIDEuNmAgaGFja3MgaW4gaGVyZSxcbiAgLy8gYmVjYXVzZSBiaXRtYXNrIHRyaW0gYnl0ZXMgZXhhY3QgdG8gYWxwaGFiZXQgc2l6ZS5cbiAgd2hpbGUgKHNpemUtLSkgaWQgKz0gdXJsQWxwaGFiZXRbYnl0ZXNbc2l6ZV0gJiA2M107XG4gIHJldHVybiBpZDtcbn07Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsTUFBTSxRQUFRLGNBQWM7QUFDckMsU0FBUyxXQUFXLFFBQVEsbUJBQW1CO0FBRS9DLE9BQU8sTUFBTSxTQUFTLENBQUMsT0FBZSxFQUFFO0VBQ3RDLElBQUksS0FBYTtFQUNqQixNQUFNLFFBQW9CLE9BQU87RUFDakMsMkRBQTJEO0VBQzNELHVFQUF1RTtFQUN2RSxzREFBc0Q7RUFDdEQseURBQXlEO0VBQ3pELHFEQUFxRDtFQUNyRCxNQUFPLE9BQVEsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHO0VBQ2xELE9BQU87QUFDVCxFQUFFIn0=