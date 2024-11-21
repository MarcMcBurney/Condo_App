import { invalid } from "../utils.ts";
export function endsWith(str) {
  return function endsWithRule(value) {
    if (typeof value !== "string") {
      return invalid("endsWith", {
        value,
        str
      }, false);
    }
    if (value.endsWith(str) === false) {
      return invalid("endsWith", {
        value,
        str
      }, false);
    }
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9lbmRzX3dpdGgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBWYWxpZGl0eSwgUnVsZSB9IGZyb20gXCIuLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgaW52YWxpZCB9IGZyb20gXCIuLi91dGlscy50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5kc1dpdGgoc3RyOiBzdHJpbmcpOiBSdWxlIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGVuZHNXaXRoUnVsZSh2YWx1ZTogYW55KTogVmFsaWRpdHkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiBpbnZhbGlkKFwiZW5kc1dpdGhcIiwgeyB2YWx1ZSwgc3RyIH0sIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAodmFsdWUuZW5kc1dpdGgoc3RyKSA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBpbnZhbGlkKFwiZW5kc1dpdGhcIiwgeyB2YWx1ZSwgc3RyIH0sIGZhbHNlKTtcbiAgICB9XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FBUyxPQUFPLFFBQVEsY0FBYztBQUV0QyxPQUFPLFNBQVMsU0FBUyxHQUFXO0VBQ2xDLE9BQU8sU0FBUyxhQUFhLEtBQVU7SUFDckMsSUFBSSxPQUFPLFVBQVUsVUFBVTtNQUM3QixPQUFPLFFBQVEsWUFBWTtRQUFFO1FBQU87TUFBSSxHQUFHO0lBQzdDO0lBRUEsSUFBSSxNQUFNLFFBQVEsQ0FBQyxTQUFTLE9BQU87TUFDakMsT0FBTyxRQUFRLFlBQVk7UUFBRTtRQUFPO01BQUksR0FBRztJQUM3QztFQUNGO0FBQ0YifQ==