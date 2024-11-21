import { clearTimes, dateChecks } from "../utils.ts";
export function dateBeforeOrEqual(date) {
  return function dateBeforeOrEqualRule(value) {
    return dateChecks(value, "dateBeforeOrEqual", {
      date
    }, (input)=>{
      return clearTimes(input).getTime() <= clearTimes(date).getTime();
    });
  };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9kYXRlX2JlZm9yZV9vcl9lcXVhbC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFZhbGlkaXR5LCBSdWxlIH0gZnJvbSBcIi4uL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBjbGVhclRpbWVzLCBkYXRlQ2hlY2tzIH0gZnJvbSBcIi4uL3V0aWxzLnRzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBkYXRlQmVmb3JlT3JFcXVhbChkYXRlOiBEYXRlKTogUnVsZSB7XG4gIHJldHVybiBmdW5jdGlvbiBkYXRlQmVmb3JlT3JFcXVhbFJ1bGUodmFsdWU6IGFueSk6IFZhbGlkaXR5IHtcbiAgICByZXR1cm4gZGF0ZUNoZWNrcyhcbiAgICAgIHZhbHVlLFxuICAgICAgXCJkYXRlQmVmb3JlT3JFcXVhbFwiLFxuICAgICAgeyBkYXRlIH0sXG4gICAgICAoaW5wdXQ6IERhdGUpOiBib29sZWFuID0+IHtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZXMoaW5wdXQpLmdldFRpbWUoKSA8PSBjbGVhclRpbWVzKGRhdGUpLmdldFRpbWUoKTtcbiAgICAgIH0sXG4gICAgKTtcbiAgfTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxTQUFTLFVBQVUsRUFBRSxVQUFVLFFBQVEsY0FBYztBQUVyRCxPQUFPLFNBQVMsa0JBQWtCLElBQVU7RUFDMUMsT0FBTyxTQUFTLHNCQUFzQixLQUFVO0lBQzlDLE9BQU8sV0FDTCxPQUNBLHFCQUNBO01BQUU7SUFBSyxHQUNQLENBQUM7TUFDQyxPQUFPLFdBQVcsT0FBTyxPQUFPLE1BQU0sV0FBVyxNQUFNLE9BQU87SUFDaEU7RUFFSjtBQUNGIn0=