import { random } from "./random.ts";
import { customRandom } from "./customRandom.ts";
/**
 * Low-level function to change alphabet and ID size.
 *
 * Alphabet must contain 256 symbols or less. Otherwise, the generator
 * will not be secure.
 *
 * @param {string} alphabet The alphabet that will be used to generate IDs.
 * @param {number} size The size(length) of the IDs that will be genereated.
 *
 * @returns A unique ID based on the alphabet provided.
 *
 * @example
 * import { customAlphabet } from "https://deno.land/x/nanoid/customAlphabet.ts";
 * 
 * const alphabet = '0123456789абвгдеё';
 * const nanoid = customAlphabet(alphabet, 5);
 * 
 * console.log(nanoid()); // => "8ё56а"
 *
 */ export const customAlphabet = (alphabet, size)=>customRandom(random, alphabet, size);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvbmFub2lkQHYzLjAuMC9jdXN0b21BbHBoYWJldC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByYW5kb20gfSBmcm9tIFwiLi9yYW5kb20udHNcIjtcbmltcG9ydCB7IGN1c3RvbVJhbmRvbSB9IGZyb20gXCIuL2N1c3RvbVJhbmRvbS50c1wiO1xuLyoqXG4gKiBMb3ctbGV2ZWwgZnVuY3Rpb24gdG8gY2hhbmdlIGFscGhhYmV0IGFuZCBJRCBzaXplLlxuICpcbiAqIEFscGhhYmV0IG11c3QgY29udGFpbiAyNTYgc3ltYm9scyBvciBsZXNzLiBPdGhlcndpc2UsIHRoZSBnZW5lcmF0b3JcbiAqIHdpbGwgbm90IGJlIHNlY3VyZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gYWxwaGFiZXQgVGhlIGFscGhhYmV0IHRoYXQgd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIElEcy5cbiAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIFRoZSBzaXplKGxlbmd0aCkgb2YgdGhlIElEcyB0aGF0IHdpbGwgYmUgZ2VuZXJlYXRlZC5cbiAqXG4gKiBAcmV0dXJucyBBIHVuaXF1ZSBJRCBiYXNlZCBvbiB0aGUgYWxwaGFiZXQgcHJvdmlkZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGN1c3RvbUFscGhhYmV0IH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvbmFub2lkL2N1c3RvbUFscGhhYmV0LnRzXCI7XG4gKiBcbiAqIGNvbnN0IGFscGhhYmV0ID0gJzAxMjM0NTY3ODnQsNCx0LLQs9C00LXRkSc7XG4gKiBjb25zdCBuYW5vaWQgPSBjdXN0b21BbHBoYWJldChhbHBoYWJldCwgNSk7XG4gKiBcbiAqIGNvbnNvbGUubG9nKG5hbm9pZCgpKTsgLy8gPT4gXCI40ZE1NtCwXCJcbiAqXG4gKi9cbmV4cG9ydCBjb25zdCBjdXN0b21BbHBoYWJldCA9IChhbHBoYWJldDogc3RyaW5nLCBzaXplOiBudW1iZXIpID0+IGN1c3RvbVJhbmRvbShyYW5kb20sIGFscGhhYmV0LCBzaXplKTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxTQUFTLE1BQU0sUUFBUSxjQUFjO0FBQ3JDLFNBQVMsWUFBWSxRQUFRLG9CQUFvQjtBQUNqRDs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQW1CQyxHQUNELE9BQU8sTUFBTSxpQkFBaUIsQ0FBQyxVQUFrQixPQUFpQixhQUFhLFFBQVEsVUFBVSxNQUFNIn0=