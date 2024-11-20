// Copyright 2018-2023 the oak authors. All rights reserved. MIT license.
const objectCloneMemo = new WeakMap();
function cloneArrayBuffer(srcBuffer, srcByteOffset, srcLength, // deno-lint-ignore no-explicit-any
_cloneConstructor) {
  // this function fudges the return type but SharedArrayBuffer is disabled for a while anyway
  return srcBuffer.slice(srcByteOffset, srcByteOffset + srcLength);
}
/** A loose approximation for structured cloning, used when the `Deno.core`
 * APIs are not available. */ // deno-lint-ignore no-explicit-any
function cloneValue(value) {
  switch(typeof value){
    case "number":
    case "string":
    case "boolean":
    case "undefined":
    case "bigint":
      return value;
    case "object":
      {
        if (objectCloneMemo.has(value)) {
          return objectCloneMemo.get(value);
        }
        if (value === null) {
          return value;
        }
        if (value instanceof Date) {
          return new Date(value.valueOf());
        }
        if (value instanceof RegExp) {
          return new RegExp(value);
        }
        if (value instanceof SharedArrayBuffer) {
          return value;
        }
        if (value instanceof ArrayBuffer) {
          const cloned = cloneArrayBuffer(value, 0, value.byteLength, ArrayBuffer);
          objectCloneMemo.set(value, cloned);
          return cloned;
        }
        if (ArrayBuffer.isView(value)) {
          const clonedBuffer = cloneValue(value.buffer);
          // Use DataViewConstructor type purely for type-checking, can be a
          // DataView or TypedArray.  They use the same constructor signature,
          // only DataView has a length in bytes and TypedArrays use a length in
          // terms of elements, so we adjust for that.
          let length;
          if (value instanceof DataView) {
            length = value.byteLength;
          } else {
            // deno-lint-ignore no-explicit-any
            length = value.length;
          }
          // deno-lint-ignore no-explicit-any
          return new value.constructor(clonedBuffer, value.byteOffset, length);
        }
        if (value instanceof Map) {
          const clonedMap = new Map();
          objectCloneMemo.set(value, clonedMap);
          value.forEach((v, k)=>{
            clonedMap.set(cloneValue(k), cloneValue(v));
          });
          return clonedMap;
        }
        if (value instanceof Set) {
          // assumes that cloneValue still takes only one argument
          const clonedSet = new Set([
            ...value
          ].map(cloneValue));
          objectCloneMemo.set(value, clonedSet);
          return clonedSet;
        }
        // default for objects
        // deno-lint-ignore no-explicit-any
        const clonedObj = {};
        objectCloneMemo.set(value, clonedObj);
        const sourceKeys = Object.getOwnPropertyNames(value);
        for (const key of sourceKeys){
          clonedObj[key] = cloneValue(value[key]);
        }
        Reflect.setPrototypeOf(clonedObj, Reflect.getPrototypeOf(value));
        return clonedObj;
      }
    case "symbol":
    case "function":
    default:
      throw new DOMException("Uncloneable value in stream", "DataCloneError");
  }
}
// deno-lint-ignore no-explicit-any
const core = Deno?.core;
const structuredClone = // deno-lint-ignore no-explicit-any
globalThis.structuredClone;
/**
 * Provides structured cloning
 * @param value
 * @returns
 */ function sc(value) {
  return structuredClone ? structuredClone(value) : core ? core.deserialize(core.serialize(value)) : cloneValue(value);
}
/** Clones a state object, skipping any values that cannot be cloned. */ // deno-lint-ignore no-explicit-any
export function cloneState(state) {
  const clone = {};
  for (const [key, value] of Object.entries(state)){
    try {
      const clonedValue = sc(value);
      clone[key] = clonedValue;
    } catch  {
    // we just no-op values that cannot be cloned
    }
  }
  return clone;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrQHYxMi42LjEvc3RydWN0dXJlZF9jbG9uZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIzIHRoZSBvYWsgYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmV4cG9ydCB0eXBlIFN0cnVjdHVyZWRDbG9uYWJsZSA9XG4gIHwgeyBba2V5OiBzdHJpbmddOiBTdHJ1Y3R1cmVkQ2xvbmFibGUgfVxuICB8IEFycmF5PFN0cnVjdHVyZWRDbG9uYWJsZT5cbiAgfCBBcnJheUJ1ZmZlclxuICB8IEFycmF5QnVmZmVyVmlld1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICB8IEJpZ0ludFxuICB8IGJpZ2ludFxuICB8IEJsb2JcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgfCBCb29sZWFuXG4gIHwgYm9vbGVhblxuICB8IERhdGVcbiAgfCBFcnJvclxuICB8IEV2YWxFcnJvclxuICB8IE1hcDxTdHJ1Y3R1cmVkQ2xvbmFibGUsIFN0cnVjdHVyZWRDbG9uYWJsZT5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgfCBOdW1iZXJcbiAgfCBudW1iZXJcbiAgfCBSYW5nZUVycm9yXG4gIHwgUmVmZXJlbmNlRXJyb3JcbiAgfCBSZWdFeHBcbiAgfCBTZXQ8U3RydWN0dXJlZENsb25hYmxlPlxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICB8IFN0cmluZ1xuICB8IHN0cmluZ1xuICB8IFN5bnRheEVycm9yXG4gIHwgVHlwZUVycm9yXG4gIHwgVVJJRXJyb3I7XG5cbi8qKiBJbnRlcm5hbCBmdW5jdGlvbnMgb24gdGhlIGBEZW5vLmNvcmVgIG5hbWVzcGFjZSAqL1xuaW50ZXJmYWNlIERlbm9Db3JlIHtcbiAgZGVzZXJpYWxpemUodmFsdWU6IHVua25vd24pOiBTdHJ1Y3R1cmVkQ2xvbmFibGU7XG4gIHNlcmlhbGl6ZSh2YWx1ZTogU3RydWN0dXJlZENsb25hYmxlKTogdW5rbm93bjtcbn1cblxuY29uc3Qgb2JqZWN0Q2xvbmVNZW1vID0gbmV3IFdlYWtNYXAoKTtcblxuZnVuY3Rpb24gY2xvbmVBcnJheUJ1ZmZlcihcbiAgc3JjQnVmZmVyOiBBcnJheUJ1ZmZlcixcbiAgc3JjQnl0ZU9mZnNldDogbnVtYmVyLFxuICBzcmNMZW5ndGg6IG51bWJlcixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX2Nsb25lQ29uc3RydWN0b3I6IGFueSxcbikge1xuICAvLyB0aGlzIGZ1bmN0aW9uIGZ1ZGdlcyB0aGUgcmV0dXJuIHR5cGUgYnV0IFNoYXJlZEFycmF5QnVmZmVyIGlzIGRpc2FibGVkIGZvciBhIHdoaWxlIGFueXdheVxuICByZXR1cm4gc3JjQnVmZmVyLnNsaWNlKFxuICAgIHNyY0J5dGVPZmZzZXQsXG4gICAgc3JjQnl0ZU9mZnNldCArIHNyY0xlbmd0aCxcbiAgKTtcbn1cblxuLyoqIEEgbG9vc2UgYXBwcm94aW1hdGlvbiBmb3Igc3RydWN0dXJlZCBjbG9uaW5nLCB1c2VkIHdoZW4gdGhlIGBEZW5vLmNvcmVgXG4gKiBBUElzIGFyZSBub3QgYXZhaWxhYmxlLiAqL1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIGNsb25lVmFsdWUodmFsdWU6IGFueSk6IGFueSB7XG4gIHN3aXRjaCAodHlwZW9mIHZhbHVlKSB7XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgIGNhc2UgXCJ1bmRlZmluZWRcIjpcbiAgICBjYXNlIFwiYmlnaW50XCI6XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgY2FzZSBcIm9iamVjdFwiOiB7XG4gICAgICBpZiAob2JqZWN0Q2xvbmVNZW1vLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIG9iamVjdENsb25lTWVtby5nZXQodmFsdWUpO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKHZhbHVlLnZhbHVlT2YoKSk7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAodmFsdWUpO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgU2hhcmVkQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgY29uc3QgY2xvbmVkID0gY2xvbmVBcnJheUJ1ZmZlcihcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAwLFxuICAgICAgICAgIHZhbHVlLmJ5dGVMZW5ndGgsXG4gICAgICAgICAgQXJyYXlCdWZmZXIsXG4gICAgICAgICk7XG4gICAgICAgIG9iamVjdENsb25lTWVtby5zZXQodmFsdWUsIGNsb25lZCk7XG4gICAgICAgIHJldHVybiBjbG9uZWQ7XG4gICAgICB9XG4gICAgICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHZhbHVlKSkge1xuICAgICAgICBjb25zdCBjbG9uZWRCdWZmZXIgPSBjbG9uZVZhbHVlKHZhbHVlLmJ1ZmZlcik7XG4gICAgICAgIC8vIFVzZSBEYXRhVmlld0NvbnN0cnVjdG9yIHR5cGUgcHVyZWx5IGZvciB0eXBlLWNoZWNraW5nLCBjYW4gYmUgYVxuICAgICAgICAvLyBEYXRhVmlldyBvciBUeXBlZEFycmF5LiAgVGhleSB1c2UgdGhlIHNhbWUgY29uc3RydWN0b3Igc2lnbmF0dXJlLFxuICAgICAgICAvLyBvbmx5IERhdGFWaWV3IGhhcyBhIGxlbmd0aCBpbiBieXRlcyBhbmQgVHlwZWRBcnJheXMgdXNlIGEgbGVuZ3RoIGluXG4gICAgICAgIC8vIHRlcm1zIG9mIGVsZW1lbnRzLCBzbyB3ZSBhZGp1c3QgZm9yIHRoYXQuXG4gICAgICAgIGxldCBsZW5ndGg7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGFWaWV3KSB7XG4gICAgICAgICAgbGVuZ3RoID0gdmFsdWUuYnl0ZUxlbmd0aDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgICAgIGxlbmd0aCA9ICh2YWx1ZSBhcyBhbnkpLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgICByZXR1cm4gbmV3ICh2YWx1ZS5jb25zdHJ1Y3RvciBhcyBhbnkpKFxuICAgICAgICAgIGNsb25lZEJ1ZmZlcixcbiAgICAgICAgICB2YWx1ZS5ieXRlT2Zmc2V0LFxuICAgICAgICAgIGxlbmd0aCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgICBjb25zdCBjbG9uZWRNYXAgPSBuZXcgTWFwKCk7XG4gICAgICAgIG9iamVjdENsb25lTWVtby5zZXQodmFsdWUsIGNsb25lZE1hcCk7XG4gICAgICAgIHZhbHVlLmZvckVhY2goKHYsIGspID0+IHtcbiAgICAgICAgICBjbG9uZWRNYXAuc2V0KGNsb25lVmFsdWUoayksIGNsb25lVmFsdWUodikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNsb25lZE1hcDtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICAvLyBhc3N1bWVzIHRoYXQgY2xvbmVWYWx1ZSBzdGlsbCB0YWtlcyBvbmx5IG9uZSBhcmd1bWVudFxuICAgICAgICBjb25zdCBjbG9uZWRTZXQgPSBuZXcgU2V0KFsuLi52YWx1ZV0ubWFwKGNsb25lVmFsdWUpKTtcbiAgICAgICAgb2JqZWN0Q2xvbmVNZW1vLnNldCh2YWx1ZSwgY2xvbmVkU2V0KTtcbiAgICAgICAgcmV0dXJuIGNsb25lZFNldDtcbiAgICAgIH1cblxuICAgICAgLy8gZGVmYXVsdCBmb3Igb2JqZWN0c1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIGNvbnN0IGNsb25lZE9iajogUmVjb3JkPGFueSwgYW55PiA9IHt9O1xuICAgICAgb2JqZWN0Q2xvbmVNZW1vLnNldCh2YWx1ZSwgY2xvbmVkT2JqKTtcbiAgICAgIGNvbnN0IHNvdXJjZUtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBzb3VyY2VLZXlzKSB7XG4gICAgICAgIGNsb25lZE9ialtrZXldID0gY2xvbmVWYWx1ZSh2YWx1ZVtrZXldKTtcbiAgICAgIH1cbiAgICAgIFJlZmxlY3Quc2V0UHJvdG90eXBlT2YoY2xvbmVkT2JqLCBSZWZsZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKSk7XG4gICAgICByZXR1cm4gY2xvbmVkT2JqO1xuICAgIH1cbiAgICBjYXNlIFwic3ltYm9sXCI6XG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBET01FeGNlcHRpb24oXCJVbmNsb25lYWJsZSB2YWx1ZSBpbiBzdHJlYW1cIiwgXCJEYXRhQ2xvbmVFcnJvclwiKTtcbiAgfVxufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuY29uc3QgY29yZSA9IChEZW5vIGFzIGFueSk/LmNvcmUgYXMgRGVub0NvcmUgfCB1bmRlZmluZWQ7XG5jb25zdCBzdHJ1Y3R1cmVkQ2xvbmU6ICgodmFsdWU6IHVua25vd24pID0+IHVua25vd24pIHwgdW5kZWZpbmVkID1cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgKGdsb2JhbFRoaXMgYXMgYW55KS5zdHJ1Y3R1cmVkQ2xvbmU7XG5cbi8qKlxuICogUHJvdmlkZXMgc3RydWN0dXJlZCBjbG9uaW5nXG4gKiBAcGFyYW0gdmFsdWVcbiAqIEByZXR1cm5zXG4gKi9cbmZ1bmN0aW9uIHNjPFQgZXh0ZW5kcyBTdHJ1Y3R1cmVkQ2xvbmFibGU+KHZhbHVlOiBUKTogVCB7XG4gIHJldHVybiBzdHJ1Y3R1cmVkQ2xvbmVcbiAgICA/IHN0cnVjdHVyZWRDbG9uZSh2YWx1ZSlcbiAgICA6IGNvcmVcbiAgICA/IGNvcmUuZGVzZXJpYWxpemUoY29yZS5zZXJpYWxpemUodmFsdWUpKVxuICAgIDogY2xvbmVWYWx1ZSh2YWx1ZSk7XG59XG5cbi8qKiBDbG9uZXMgYSBzdGF0ZSBvYmplY3QsIHNraXBwaW5nIGFueSB2YWx1ZXMgdGhhdCBjYW5ub3QgYmUgY2xvbmVkLiAqL1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBjbG9uZVN0YXRlPFMgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCBhbnk+PihzdGF0ZTogUyk6IFMge1xuICBjb25zdCBjbG9uZSA9IHt9IGFzIFM7XG4gIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHN0YXRlKSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjbG9uZWRWYWx1ZSA9IHNjKHZhbHVlKTtcbiAgICAgIGNsb25lW2tleSBhcyBrZXlvZiBTXSA9IGNsb25lZFZhbHVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gd2UganVzdCBuby1vcCB2YWx1ZXMgdGhhdCBjYW5ub3QgYmUgY2xvbmVkXG4gICAgfVxuICB9XG4gIHJldHVybiBjbG9uZTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx5RUFBeUU7QUFzQ3pFLE1BQU0sa0JBQWtCLElBQUk7QUFFNUIsU0FBUyxpQkFDUCxTQUFzQixFQUN0QixhQUFxQixFQUNyQixTQUFpQixFQUNqQixtQ0FBbUM7QUFDbkMsaUJBQXNCO0VB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