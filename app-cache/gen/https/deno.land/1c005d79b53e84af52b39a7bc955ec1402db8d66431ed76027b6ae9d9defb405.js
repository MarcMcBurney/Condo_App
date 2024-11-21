import { invalid } from "../utils.ts";
export function minNumber(minValue) {
  return function minRule(value) {
    if (typeof value !== "number" || value < minValue) {
      return invalid("minNumber", {
        value,
        minValue
      });
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9taW5fbnVtYmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgVmFsaWRpdHksIFJ1bGUgfSBmcm9tIFwiLi4vdHlwZXMudHNcIjtcbmltcG9ydCB7IGludmFsaWQgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIG1pbk51bWJlcihtaW5WYWx1ZTogbnVtYmVyKTogUnVsZSB7XG4gIHJldHVybiBmdW5jdGlvbiBtaW5SdWxlKHZhbHVlOiBhbnkpOiBWYWxpZGl0eSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJudW1iZXJcIiB8fCB2YWx1ZSA8IG1pblZhbHVlKSB7XG4gICAgICByZXR1cm4gaW52YWxpZChcIm1pbk51bWJlclwiLCB7IHZhbHVlLCBtaW5WYWx1ZSB9KTtcbiAgICB9XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FBUyxPQUFPLFFBQVEsY0FBYztBQUV0QyxPQUFPLFNBQVMsVUFBVSxRQUFnQjtFQUN4QyxPQUFPLFNBQVMsUUFBUSxLQUFVO0lBQ2hDLElBQUksT0FBTyxVQUFVLFlBQVksUUFBUSxVQUFVO01BQ2pELE9BQU8sUUFBUSxhQUFhO1FBQUU7UUFBTztNQUFTO0lBQ2hEO0VBQ0Y7QUFDRiJ9