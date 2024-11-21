import { required } from "./required.ts";
import { optionallyValid } from "../utils.ts";
export function requiredUnless(field, fieldValue) {
  return function requiredUnlessRule(value, { getValue }) {
    const val = getValue(field);
    if (val !== fieldValue) {
      return required(value);
    }
    return optionallyValid(true);
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9yZXF1aXJlZF91bmxlc3MudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBWYWxpZGl0eSwgUnVsZSB9IGZyb20gXCIuLi90eXBlcy50c1wiO1xuaW1wb3J0IHsgcmVxdWlyZWQgfSBmcm9tIFwiLi9yZXF1aXJlZC50c1wiO1xuaW1wb3J0IHsgb3B0aW9uYWxseVZhbGlkIH0gZnJvbSBcIi4uL3V0aWxzLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXF1aXJlZFVubGVzcyhmaWVsZDogc3RyaW5nLCBmaWVsZFZhbHVlOiBhbnkpOiBSdWxlIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHJlcXVpcmVkVW5sZXNzUnVsZSh2YWx1ZTogYW55LCB7IGdldFZhbHVlIH0pOiBWYWxpZGl0eSB7XG4gICAgY29uc3QgdmFsID0gZ2V0VmFsdWUoZmllbGQpO1xuICAgIGlmICh2YWwgIT09IGZpZWxkVmFsdWUpIHtcbiAgICAgIHJldHVybiByZXF1aXJlZCh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25hbGx5VmFsaWQodHJ1ZSk7XG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBQ3pDLFNBQVMsZUFBZSxRQUFRLGNBQWM7QUFFOUMsT0FBTyxTQUFTLGVBQWUsS0FBYSxFQUFFLFVBQWU7RUFDM0QsT0FBTyxTQUFTLG1CQUFtQixLQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUU7SUFDekQsTUFBTSxNQUFNLFNBQVM7SUFDckIsSUFBSSxRQUFRLFlBQVk7TUFDdEIsT0FBTyxTQUFTO0lBQ2xCO0lBQ0EsT0FBTyxnQkFBZ0I7RUFDekI7QUFDRiJ9