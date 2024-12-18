import { invalid } from "../utils.ts";
export function isIPv6(value) {
  const invalidResult = invalid("isIPv6", {
    value
  });
  if (typeof value !== "string") {
    return invalidResult;
  }
  const segments = value.split(":");
  const invalidSegments = segments.filter((s)=>!s.match(/^(|[0-9a-f]{1,4})$/i));
  if (invalidSegments.length > 0) {
    return invalidResult;
  }
  const emptySegmentsCount = segments.filter((s)=>s === "").length;
  const startsWithLeadingZeros = value.match(/^::/) ? true : false;
  const endsWithLeadingZeros = value.match(/::$/) ? true : false;
  const maxSegments = startsWithLeadingZeros || endsWithLeadingZeros ? 9 : 8;
  let maxEmptySegments = 1;
  if (startsWithLeadingZeros) {
    maxEmptySegments += 1;
  }
  if (endsWithLeadingZeros) {
    maxEmptySegments += 1;
  }
  if (segments.length > maxSegments || emptySegmentsCount > maxEmptySegments) {
    return invalidResult;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvdmFsaWRhc2F1ckB2MC4xNS4wL3NyYy9ydWxlcy9pc19pcHY2LnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgVmFsaWRpdHkgfSBmcm9tIFwiLi4vdHlwZXMudHNcIjtcbmltcG9ydCB7IGludmFsaWQgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSVB2Nih2YWx1ZTogYW55KTogVmFsaWRpdHkge1xuICBjb25zdCBpbnZhbGlkUmVzdWx0ID0gaW52YWxpZChcImlzSVB2NlwiLCB7IHZhbHVlIH0pO1xuXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gaW52YWxpZFJlc3VsdDtcbiAgfVxuXG4gIGNvbnN0IHNlZ21lbnRzID0gdmFsdWUuc3BsaXQoXCI6XCIpO1xuXG4gIGNvbnN0IGludmFsaWRTZWdtZW50cyA9IHNlZ21lbnRzLmZpbHRlcihcbiAgICAocykgPT4gIXMubWF0Y2goL14ofFswLTlhLWZdezEsNH0pJC9pKSxcbiAgKTtcbiAgaWYgKGludmFsaWRTZWdtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGludmFsaWRSZXN1bHQ7XG4gIH1cblxuICBjb25zdCBlbXB0eVNlZ21lbnRzQ291bnQgPSBzZWdtZW50cy5maWx0ZXIoKHMpID0+IHMgPT09IFwiXCIpLmxlbmd0aDtcbiAgY29uc3Qgc3RhcnRzV2l0aExlYWRpbmdaZXJvcyA9IHZhbHVlLm1hdGNoKC9eOjovKSA/IHRydWUgOiBmYWxzZTtcbiAgY29uc3QgZW5kc1dpdGhMZWFkaW5nWmVyb3MgPSB2YWx1ZS5tYXRjaCgvOjokLykgPyB0cnVlIDogZmFsc2U7XG5cbiAgY29uc3QgbWF4U2VnbWVudHMgPSBzdGFydHNXaXRoTGVhZGluZ1plcm9zIHx8IGVuZHNXaXRoTGVhZGluZ1plcm9zID8gOSA6IDg7XG5cbiAgbGV0IG1heEVtcHR5U2VnbWVudHMgPSAxO1xuICBpZiAoc3RhcnRzV2l0aExlYWRpbmdaZXJvcykge1xuICAgIG1heEVtcHR5U2VnbWVudHMgKz0gMTtcbiAgfVxuICBpZiAoZW5kc1dpdGhMZWFkaW5nWmVyb3MpIHtcbiAgICBtYXhFbXB0eVNlZ21lbnRzICs9IDE7XG4gIH1cblxuICBpZiAoc2VnbWVudHMubGVuZ3RoID4gbWF4U2VnbWVudHMgfHwgZW1wdHlTZWdtZW50c0NvdW50ID4gbWF4RW1wdHlTZWdtZW50cykge1xuICAgIHJldHVybiBpbnZhbGlkUmVzdWx0O1xuICB9XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsU0FBUyxPQUFPLFFBQVEsY0FBYztBQUV0QyxPQUFPLFNBQVMsT0FBTyxLQUFVO0VBQy9CLE1BQU0sZ0JBQWdCLFFBQVEsVUFBVTtJQUFFO0VBQU07RUFFaEQsSUFBSSxPQUFPLFVBQVUsVUFBVTtJQUM3QixPQUFPO0VBQ1Q7RUFFQSxNQUFNLFdBQVcsTUFBTSxLQUFLLENBQUM7RUFFN0IsTUFBTSxrQkFBa0IsU0FBUyxNQUFNLENBQ3JDLENBQUMsSUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDO0VBRWxCLElBQUksZ0JBQWdCLE1BQU0sR0FBRyxHQUFHO0lBQzlCLE9BQU87RUFDVDtFQUVBLE1BQU0scUJBQXFCLFNBQVMsTUFBTSxDQUFDLENBQUMsSUFBTSxNQUFNLElBQUksTUFBTTtFQUNsRSxNQUFNLHlCQUF5QixNQUFNLEtBQUssQ0FBQyxTQUFTLE9BQU87RUFDM0QsTUFBTSx1QkFBdUIsTUFBTSxLQUFLLENBQUMsU0FBUyxPQUFPO0VBRXpELE1BQU0sY0FBYywwQkFBMEIsdUJBQXVCLElBQUk7RUFFekUsSUFBSSxtQkFBbUI7RUFDdkIsSUFBSSx3QkFBd0I7SUFDMUIsb0JBQW9CO0VBQ3RCO0VBQ0EsSUFBSSxzQkFBc0I7SUFDeEIsb0JBQW9CO0VBQ3RCO0VBRUEsSUFBSSxTQUFTLE1BQU0sR0FBRyxlQUFlLHFCQUFxQixrQkFBa0I7SUFDMUUsT0FBTztFQUNUO0FBQ0YifQ==