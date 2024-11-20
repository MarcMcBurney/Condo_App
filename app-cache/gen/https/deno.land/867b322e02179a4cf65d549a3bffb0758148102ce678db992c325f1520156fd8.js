// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * Merge multiple streams into a single one, taking order into account, and each stream
 * will wait for a chunk to enqueue before the next stream can append another chunk.
 * If a stream ends before other ones, the others will be cancelled.
 */ export function earlyZipReadableStreams(...streams) {
  const readers = streams.map((s)=>s.getReader());
  return new ReadableStream({
    async start (controller) {
      try {
        loop: while(true){
          for (const reader of readers){
            const { value, done } = await reader.read();
            if (!done) {
              controller.enqueue(value);
            } else {
              await Promise.all(readers.map((reader)=>reader.cancel()));
              break loop;
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    }
  });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3N0cmVhbXMvZWFybHlfemlwX3JlYWRhYmxlX3N0cmVhbXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLyoqXG4gKiBNZXJnZSBtdWx0aXBsZSBzdHJlYW1zIGludG8gYSBzaW5nbGUgb25lLCB0YWtpbmcgb3JkZXIgaW50byBhY2NvdW50LCBhbmQgZWFjaCBzdHJlYW1cbiAqIHdpbGwgd2FpdCBmb3IgYSBjaHVuayB0byBlbnF1ZXVlIGJlZm9yZSB0aGUgbmV4dCBzdHJlYW0gY2FuIGFwcGVuZCBhbm90aGVyIGNodW5rLlxuICogSWYgYSBzdHJlYW0gZW5kcyBiZWZvcmUgb3RoZXIgb25lcywgdGhlIG90aGVycyB3aWxsIGJlIGNhbmNlbGxlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVhcmx5WmlwUmVhZGFibGVTdHJlYW1zPFQ+KFxuICAuLi5zdHJlYW1zOiBSZWFkYWJsZVN0cmVhbTxUPltdXG4pOiBSZWFkYWJsZVN0cmVhbTxUPiB7XG4gIGNvbnN0IHJlYWRlcnMgPSBzdHJlYW1zLm1hcCgocykgPT4gcy5nZXRSZWFkZXIoKSk7XG4gIHJldHVybiBuZXcgUmVhZGFibGVTdHJlYW08VD4oe1xuICAgIGFzeW5jIHN0YXJ0KGNvbnRyb2xsZXIpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxvb3A6XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgZm9yIChjb25zdCByZWFkZXIgb2YgcmVhZGVycykge1xuICAgICAgICAgICAgY29uc3QgeyB2YWx1ZSwgZG9uZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgICAgIGlmICghZG9uZSkge1xuICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUodmFsdWUhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHJlYWRlcnMubWFwKChyZWFkZXIpID0+IHJlYWRlci5jYW5jZWwoKSkpO1xuICAgICAgICAgICAgICBicmVhayBsb29wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgfSxcbiAgfSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHFDQUFxQztBQUVyQzs7OztDQUlDLEdBQ0QsT0FBTyxTQUFTLHdCQUNkLEdBQUcsT0FBNEI7RUFFL0IsTUFBTSxVQUFVLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBTSxFQUFFLFNBQVM7RUFDOUMsT0FBTyxJQUFJLGVBQWtCO0lBQzNCLE1BQU0sT0FBTSxVQUFVO01BQ3BCLElBQUk7UUFDRixNQUNBLE1BQU8sS0FBTTtVQUNYLEtBQUssTUFBTSxVQUFVLFFBQVM7WUFDNUIsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsR0FBRyxNQUFNLE9BQU8sSUFBSTtZQUN6QyxJQUFJLENBQUMsTUFBTTtjQUNULFdBQVcsT0FBTyxDQUFDO1lBQ3JCLE9BQU87Y0FDTCxNQUFNLFFBQVEsR0FBRyxDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUMsU0FBVyxPQUFPLE1BQU07Y0FDdkQsTUFBTTtZQUNSO1VBQ0Y7UUFDRjtRQUNBLFdBQVcsS0FBSztNQUNsQixFQUFFLE9BQU8sR0FBRztRQUNWLFdBQVcsS0FBSyxDQUFDO01BQ25CO0lBQ0Y7RUFDRjtBQUNGIn0=