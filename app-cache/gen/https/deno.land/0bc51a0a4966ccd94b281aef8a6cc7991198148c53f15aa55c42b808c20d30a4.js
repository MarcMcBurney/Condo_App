import { invalid } from "../utils.ts";
export function match(regex, trim = false) {
  return function matchRule(value) {
    if (typeof value !== "string") {
      return invalid("match", {
        value,
        regex
      }, false);
    }
    if (trim) {
      value = value.trim();
    }
    if (!value.match(regex)) {
      return invalid("match", {
        value,
        regex
      }, false);
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9tYXRjaC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFZhbGlkaXR5LCBSdWxlIH0gZnJvbSBcIi4uL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBpbnZhbGlkIH0gZnJvbSBcIi4uL3V0aWxzLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaChyZWdleDogUmVnRXhwLCB0cmltOiBib29sZWFuID0gZmFsc2UpOiBSdWxlIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIG1hdGNoUnVsZSh2YWx1ZTogYW55KTogVmFsaWRpdHkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiBpbnZhbGlkKFwibWF0Y2hcIiwgeyB2YWx1ZSwgcmVnZXggfSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmICh0cmltKSB7XG4gICAgICB2YWx1ZSA9IHZhbHVlLnRyaW0oKTtcbiAgICB9XG5cbiAgICBpZiAoIXZhbHVlLm1hdGNoKHJlZ2V4KSkge1xuICAgICAgcmV0dXJuIGludmFsaWQoXCJtYXRjaFwiLCB7IHZhbHVlLCByZWdleCB9LCBmYWxzZSk7XG4gICAgfVxuICB9O1xufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsT0FBTyxRQUFRLGNBQWM7QUFFdEMsT0FBTyxTQUFTLE1BQU0sS0FBYSxFQUFFLE9BQWdCLEtBQUs7RUFDeEQsT0FBTyxTQUFTLFVBQVUsS0FBVTtJQUNsQyxJQUFJLE9BQU8sVUFBVSxVQUFVO01BQzdCLE9BQU8sUUFBUSxTQUFTO1FBQUU7UUFBTztNQUFNLEdBQUc7SUFDNUM7SUFFQSxJQUFJLE1BQU07TUFDUixRQUFRLE1BQU0sSUFBSTtJQUNwQjtJQUVBLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxRQUFRO01BQ3ZCLE9BQU8sUUFBUSxTQUFTO1FBQUU7UUFBTztNQUFNLEdBQUc7SUFDNUM7RUFDRjtBQUNGIn0=