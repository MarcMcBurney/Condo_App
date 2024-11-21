import { invalid } from "../utils.ts";
export function isEmail(value) {
  // https://stackoverflow.com/a/46181
  const regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (typeof value !== "string" || !regex.test(value.toLowerCase())) {
    return invalid("isEmail", {
      value
    });
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9pc19lbWFpbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFZhbGlkaXR5IH0gZnJvbSBcIi4uL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBpbnZhbGlkIH0gZnJvbSBcIi4uL3V0aWxzLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VtYWlsKHZhbHVlOiBhbnkpOiBWYWxpZGl0eSB7XG4gIC8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vYS80NjE4MVxuICBjb25zdCByZWdleCA9XG4gICAgL14oKFtePD4oKVtcXF1cXFxcLiw7Olxcc0BcXFwiXSsoXFwuW148PigpW1xcXVxcXFwuLDs6XFxzQFxcXCJdKykqKXwoXFxcIi4rXFxcIikpQCgoXFxbWzAtOV17MSwzfVxcLlswLTldezEsM31cXC5bMC05XXsxLDN9XFwuWzAtOV17MSwzfVxcXSl8KChbYS16QS1aXFwtMC05XStcXC4pK1thLXpBLVpdezIsfSkpJC87XG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIgfHwgIXJlZ2V4LnRlc3QodmFsdWUudG9Mb3dlckNhc2UoKSkpIHtcbiAgICByZXR1cm4gaW52YWxpZChcImlzRW1haWxcIiwgeyB2YWx1ZSB9KTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLFNBQVMsT0FBTyxRQUFRLGNBQWM7QUFFdEMsT0FBTyxTQUFTLFFBQVEsS0FBVTtFQUNoQyxvQ0FBb0M7RUFDcEMsTUFBTSxRQUNKO0VBQ0YsSUFBSSxPQUFPLFVBQVUsWUFBWSxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sV0FBVyxLQUFLO0lBQ2pFLE9BQU8sUUFBUSxXQUFXO01BQUU7SUFBTTtFQUNwQztBQUNGIn0=