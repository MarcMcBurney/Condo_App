import { invalid } from "../utils.ts";
export function maxLength(maxValue) {
  return function maxLengthRule(value) {
    if (typeof value !== "string") {
      return invalid("maxLength", {
        value,
        maxValue
      }, false);
    }
    if (value.length > maxValue) {
      return invalid("maxLength", {
        value,
        maxValue
      }, false);
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9tYXhfbGVuZ3RoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgVmFsaWRpdHksIFJ1bGUgfSBmcm9tIFwiLi4vdHlwZXMudHNcIjtcbmltcG9ydCB7IGludmFsaWQgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIG1heExlbmd0aChtYXhWYWx1ZTogbnVtYmVyKTogUnVsZSB7XG4gIHJldHVybiBmdW5jdGlvbiBtYXhMZW5ndGhSdWxlKHZhbHVlOiBhbnkpOiBWYWxpZGl0eSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIGludmFsaWQoXCJtYXhMZW5ndGhcIiwgeyB2YWx1ZSwgbWF4VmFsdWUgfSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmICh2YWx1ZS5sZW5ndGggPiBtYXhWYWx1ZSkge1xuICAgICAgcmV0dXJuIGludmFsaWQoXCJtYXhMZW5ndGhcIiwgeyB2YWx1ZSwgbWF4VmFsdWUgfSwgZmFsc2UpO1xuICAgIH1cbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLE9BQU8sUUFBUSxjQUFjO0FBRXRDLE9BQU8sU0FBUyxVQUFVLFFBQWdCO0VBQ3hDLE9BQU8sU0FBUyxjQUFjLEtBQVU7SUFDdEMsSUFBSSxPQUFPLFVBQVUsVUFBVTtNQUM3QixPQUFPLFFBQVEsYUFBYTtRQUFFO1FBQU87TUFBUyxHQUFHO0lBQ25EO0lBRUEsSUFBSSxNQUFNLE1BQU0sR0FBRyxVQUFVO01BQzNCLE9BQU8sUUFBUSxhQUFhO1FBQUU7UUFBTztNQUFTLEdBQUc7SUFDbkQ7RUFDRjtBQUNGIn0=