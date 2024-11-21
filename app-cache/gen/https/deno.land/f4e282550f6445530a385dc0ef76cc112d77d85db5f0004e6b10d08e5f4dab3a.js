import { invalid, isOptionalValue } from "../utils.ts";
import { required } from "./required.ts";
import { validateValue } from "../validate.ts";
export function validateArray(isRequired, rules, { minLength, maxLength } = {
  minLength: 0
}) {
  return [
    ...isRequired ? [
      required
    ] : [],
    async function ruleArray(value, utils) {
      if (isRequired === false && isOptionalValue(value)) {
        return;
      }
      if (!Array.isArray(value)) {
        return invalid("validateArray:arrayCheck", {
          value
        }, true);
      }
      if (typeof minLength === "number" && value.length < minLength) {
        return invalid("validateArray:minLengthCheck", {
          value,
          minLength: minLength
        });
      }
      if (typeof maxLength === "number" && value.length > maxLength) {
        return invalid("validateArray:maxLengthCheck", {
          value,
          maxLength: maxLength
        });
      }
      const errors = {};
      for(let i in value){
        const errs = await validateValue(value[i], rules, utils);
        if (errs.length) {
          errors[i.toString()] = [
            ...errs
          ];
        }
      }
      if (Object.keys(errors).length > 0) {
        return invalid("validateArray", {
          value,
          errors
        }, true);
      }
    }
  ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy92YWxpZGF0ZV9hcnJheS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFZhbGlkaXR5LCBSdWxlIH0gZnJvbSBcIi4uL3R5cGVzLnRzXCI7XG5pbXBvcnQgdHlwZSB7IFJhd1ZhbGlkYXRpb25SZXN1bHQsIFZhbGlkYXRpb25VdGlscyB9IGZyb20gXCIuLi9pbnRlcmZhY2VzLnRzXCI7XG5pbXBvcnQgeyBpbnZhbGlkLCBpc09wdGlvbmFsVmFsdWUgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcbmltcG9ydCB7IHJlcXVpcmVkIH0gZnJvbSBcIi4vcmVxdWlyZWQudHNcIjtcbmltcG9ydCB7IHZhbGlkYXRlVmFsdWUgfSBmcm9tIFwiLi4vdmFsaWRhdGUudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0ZUFycmF5T3B0aW9ucyB7XG4gIG1pbkxlbmd0aD86IG51bWJlcjtcbiAgbWF4TGVuZ3RoPzogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVBcnJheShcbiAgaXNSZXF1aXJlZDogYm9vbGVhbixcbiAgcnVsZXM6IFJ1bGVbXSxcbiAgeyBtaW5MZW5ndGgsIG1heExlbmd0aCB9OiBWYWxpZGF0ZUFycmF5T3B0aW9ucyA9IHtcbiAgICBtaW5MZW5ndGg6IDAsXG4gIH0sXG4pOiBSdWxlW10ge1xuICByZXR1cm4gW1xuICAgIC4uLihpc1JlcXVpcmVkID8gW3JlcXVpcmVkXSA6IFtdKSxcbiAgICBhc3luYyBmdW5jdGlvbiBydWxlQXJyYXkoXG4gICAgICB2YWx1ZTogYW55LFxuICAgICAgdXRpbHM6IFZhbGlkYXRpb25VdGlscyxcbiAgICApOiBQcm9taXNlPFZhbGlkaXR5PiB7XG4gICAgICBpZiAoaXNSZXF1aXJlZCA9PT0gZmFsc2UgJiYgaXNPcHRpb25hbFZhbHVlKHZhbHVlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGludmFsaWQoXCJ2YWxpZGF0ZUFycmF5OmFycmF5Q2hlY2tcIiwgeyB2YWx1ZSB9LCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBtaW5MZW5ndGggPT09IFwibnVtYmVyXCIgJiYgdmFsdWUubGVuZ3RoIDwgbWluTGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBpbnZhbGlkKFwidmFsaWRhdGVBcnJheTptaW5MZW5ndGhDaGVja1wiLCB7XG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgbWluTGVuZ3RoOiBtaW5MZW5ndGgsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG1heExlbmd0aCA9PT0gXCJudW1iZXJcIiAmJiB2YWx1ZS5sZW5ndGggPiBtYXhMZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGludmFsaWQoXCJ2YWxpZGF0ZUFycmF5Om1heExlbmd0aENoZWNrXCIsIHtcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBtYXhMZW5ndGg6IG1heExlbmd0aCxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVycm9yczogUmF3VmFsaWRhdGlvblJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChsZXQgaSBpbiB2YWx1ZSkge1xuICAgICAgICBjb25zdCBlcnJzID0gYXdhaXQgdmFsaWRhdGVWYWx1ZSh2YWx1ZVtpXSwgcnVsZXMsIHV0aWxzKTtcbiAgICAgICAgaWYgKGVycnMubGVuZ3RoKSB7XG4gICAgICAgICAgZXJyb3JzW2kudG9TdHJpbmcoKV0gPSBbLi4uZXJyc107XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKE9iamVjdC5rZXlzKGVycm9ycykubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gaW52YWxpZChcInZhbGlkYXRlQXJyYXlcIiwgeyB2YWx1ZSwgZXJyb3JzIH0sIHRydWUpO1xuICAgICAgfVxuICAgIH0sXG4gIF07XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsU0FBUyxPQUFPLEVBQUUsZUFBZSxRQUFRLGNBQWM7QUFDdkQsU0FBUyxRQUFRLFFBQVEsZ0JBQWdCO0FBQ3pDLFNBQVMsYUFBYSxRQUFRLGlCQUFpQjtBQU8vQyxPQUFPLFNBQVMsY0FDZCxVQUFtQixFQUNuQixLQUFhLEVBQ2IsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUF3QixHQUFHO0VBQy9DLFdBQVc7QUFDYixDQUFDO0VBRUQsT0FBTztPQUNELGFBQWE7TUFBQztLQUFTLEdBQUcsRUFBRTtJQUNoQyxlQUFlLFVBQ2IsS0FBVSxFQUNWLEtBQXNCO01BRXRCLElBQUksZUFBZSxTQUFTLGdCQUFnQixRQUFRO1FBQ2xEO01BQ0Y7TUFFQSxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsUUFBUTtRQUN6QixPQUFPLFFBQVEsNEJBQTRCO1VBQUU7UUFBTSxHQUFHO01BQ3hEO01BRUEsSUFBSSxPQUFPLGNBQWMsWUFBWSxNQUFNLE1BQU0sR0FBRyxXQUFXO1FBQzdELE9BQU8sUUFBUSxnQ0FBZ0M7VUFDN0M7VUFDQSxXQUFXO1FBQ2I7TUFDRjtNQUVBLElBQUksT0FBTyxjQUFjLFlBQVksTUFBTSxNQUFNLEdBQUcsV0FBVztRQUM3RCxPQUFPLFFBQVEsZ0NBQWdDO1VBQzdDO1VBQ0EsV0FBVztRQUNiO01BQ0Y7TUFFQSxNQUFNLFNBQThCLENBQUM7TUFDckMsSUFBSyxJQUFJLEtBQUssTUFBTztRQUNuQixNQUFNLE9BQU8sTUFBTSxjQUFjLEtBQUssQ0FBQyxFQUFFLEVBQUUsT0FBTztRQUNsRCxJQUFJLEtBQUssTUFBTSxFQUFFO1VBQ2YsTUFBTSxDQUFDLEVBQUUsUUFBUSxHQUFHLEdBQUc7ZUFBSTtXQUFLO1FBQ2xDO01BQ0Y7TUFFQSxJQUFJLE9BQU8sSUFBSSxDQUFDLFFBQVEsTUFBTSxHQUFHLEdBQUc7UUFDbEMsT0FBTyxRQUFRLGlCQUFpQjtVQUFFO1VBQU87UUFBTyxHQUFHO01BQ3JEO0lBQ0Y7R0FDRDtBQUNIIn0=