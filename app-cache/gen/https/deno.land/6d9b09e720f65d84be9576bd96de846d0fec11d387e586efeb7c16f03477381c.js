import { invalid } from "../utils.ts";
export function isIPv4(value) {
  if (typeof value !== "string") {
    return invalid("isIPv4", {
      value
    });
  }
  if (!value.match(/^(?:(?:^|\.)(?:2(?:5[0-5]|[0-4]\d)|1?\d?\d)){4}$/)) {
    return invalid("isIPv4", {
      value
    });
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9pc19pcHY0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgVmFsaWRpdHkgfSBmcm9tIFwiLi4vdHlwZXMudHNcIjtcbmltcG9ydCB7IGludmFsaWQgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSVB2NCh2YWx1ZTogYW55KTogVmFsaWRpdHkge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGludmFsaWQoXCJpc0lQdjRcIiwgeyB2YWx1ZSB9KTtcbiAgfVxuXG4gIGlmICghdmFsdWUubWF0Y2goL14oPzooPzpefFxcLikoPzoyKD86NVswLTVdfFswLTRdXFxkKXwxP1xcZD9cXGQpKXs0fSQvKSkge1xuICAgIHJldHVybiBpbnZhbGlkKFwiaXNJUHY0XCIsIHsgdmFsdWUgfSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLE9BQU8sUUFBUSxjQUFjO0FBRXRDLE9BQU8sU0FBUyxPQUFPLEtBQVU7RUFDL0IsSUFBSSxPQUFPLFVBQVUsVUFBVTtJQUM3QixPQUFPLFFBQVEsVUFBVTtNQUFFO0lBQU07RUFDbkM7RUFFQSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMscURBQXFEO0lBQ3BFLE9BQU8sUUFBUSxVQUFVO01BQUU7SUFBTTtFQUNuQztBQUNGIn0=