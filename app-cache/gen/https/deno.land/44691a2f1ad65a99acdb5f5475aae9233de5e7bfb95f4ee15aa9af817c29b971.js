// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { isWindows } from "../_util/os.ts";
import { posixToNamespacedPath, windowsToNamespacedPath } from "./_to_namespaced_path.ts";
/**
 * Resolves path to a namespace path
 * @param path to resolve to namespace
 */ export function toNamespacedPath(path) {
  return isWindows ? windowsToNamespacedPath(path) : posixToNamespacedPath(path);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3BhdGgvdG9fbmFtZXNwYWNlZF9wYXRoLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjMgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHtcbiAgcG9zaXhUb05hbWVzcGFjZWRQYXRoLFxuICB3aW5kb3dzVG9OYW1lc3BhY2VkUGF0aCxcbn0gZnJvbSBcIi4vX3RvX25hbWVzcGFjZWRfcGF0aC50c1wiO1xuXG4vKipcbiAqIFJlc29sdmVzIHBhdGggdG8gYSBuYW1lc3BhY2UgcGF0aFxuICogQHBhcmFtIHBhdGggdG8gcmVzb2x2ZSB0byBuYW1lc3BhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvTmFtZXNwYWNlZFBhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGlzV2luZG93c1xuICAgID8gd2luZG93c1RvTmFtZXNwYWNlZFBhdGgocGF0aClcbiAgICA6IHBvc2l4VG9OYW1lc3BhY2VkUGF0aChwYXRoKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLFNBQVMsU0FBUyxRQUFRLGlCQUFpQjtBQUMzQyxTQUNFLHFCQUFxQixFQUNyQix1QkFBdUIsUUFDbEIsMkJBQTJCO0FBRWxDOzs7Q0FHQyxHQUNELE9BQU8sU0FBUyxpQkFBaUIsSUFBWTtFQUMzQyxPQUFPLFlBQ0gsd0JBQXdCLFFBQ3hCLHNCQUFzQjtBQUM1QiJ9