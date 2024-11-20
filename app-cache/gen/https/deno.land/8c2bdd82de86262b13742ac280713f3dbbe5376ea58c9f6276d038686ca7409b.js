// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/**
 * Merge multiple streams into a single one, taking order into account, and each stream
 * will wait for a chunk to enqueue before the next stream can append another chunk.
 * If a stream ends before other ones, the others will continue adding data in order,
 * and the finished one will not add any more data.
 */ export function zipReadableStreams(...streams) {
  const readers = streams.map((s)=>s.getReader());
  return new ReadableStream({
    async start (controller) {
      try {
        let resolved = 0;
        while(resolved != streams.length){
          for (const [key, reader] of Object.entries(readers)){
            const { value, done } = await reader.read();
            if (!done) {
              controller.enqueue(value);
            } else {
              resolved++;
              readers.splice(+key, 1);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3N0cmVhbXMvemlwX3JlYWRhYmxlX3N0cmVhbXMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMyB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRoaXMgbW9kdWxlIGlzIGJyb3dzZXIgY29tcGF0aWJsZS5cblxuLyoqXG4gKiBNZXJnZSBtdWx0aXBsZSBzdHJlYW1zIGludG8gYSBzaW5nbGUgb25lLCB0YWtpbmcgb3JkZXIgaW50byBhY2NvdW50LCBhbmQgZWFjaCBzdHJlYW1cbiAqIHdpbGwgd2FpdCBmb3IgYSBjaHVuayB0byBlbnF1ZXVlIGJlZm9yZSB0aGUgbmV4dCBzdHJlYW0gY2FuIGFwcGVuZCBhbm90aGVyIGNodW5rLlxuICogSWYgYSBzdHJlYW0gZW5kcyBiZWZvcmUgb3RoZXIgb25lcywgdGhlIG90aGVycyB3aWxsIGNvbnRpbnVlIGFkZGluZyBkYXRhIGluIG9yZGVyLFxuICogYW5kIHRoZSBmaW5pc2hlZCBvbmUgd2lsbCBub3QgYWRkIGFueSBtb3JlIGRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB6aXBSZWFkYWJsZVN0cmVhbXM8VD4oXG4gIC4uLnN0cmVhbXM6IFJlYWRhYmxlU3RyZWFtPFQ+W11cbik6IFJlYWRhYmxlU3RyZWFtPFQ+IHtcbiAgY29uc3QgcmVhZGVycyA9IHN0cmVhbXMubWFwKChzKSA9PiBzLmdldFJlYWRlcigpKTtcbiAgcmV0dXJuIG5ldyBSZWFkYWJsZVN0cmVhbTxUPih7XG4gICAgYXN5bmMgc3RhcnQoY29udHJvbGxlcikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbGV0IHJlc29sdmVkID0gMDtcbiAgICAgICAgd2hpbGUgKHJlc29sdmVkICE9IHN0cmVhbXMubGVuZ3RoKSB7XG4gICAgICAgICAgZm9yIChjb25zdCBba2V5LCByZWFkZXJdIG9mIE9iamVjdC5lbnRyaWVzKHJlYWRlcnMpKSB7XG4gICAgICAgICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgICAgICAgaWYgKCFkb25lKSB7XG4gICAgICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZSh2YWx1ZSEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZWQrKztcbiAgICAgICAgICAgICAgcmVhZGVycy5zcGxpY2UoK2tleSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29udHJvbGxlci5lcnJvcihlKTtcbiAgICAgIH1cbiAgICB9LFxuICB9KTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDOzs7OztDQUtDLEdBQ0QsT0FBTyxTQUFTLG1CQUNkLEdBQUcsT0FBNEI7RUFFL0IsTUFBTSxVQUFVLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBTSxFQUFFLFNBQVM7RUFDOUMsT0FBTyxJQUFJLGVBQWtCO0lBQzNCLE1BQU0sT0FBTSxVQUFVO01BQ3BCLElBQUk7UUFDRixJQUFJLFdBQVc7UUFDZixNQUFPLFlBQVksUUFBUSxNQUFNLENBQUU7VUFDakMsS0FBSyxNQUFNLENBQUMsS0FBSyxPQUFPLElBQUksT0FBTyxPQUFPLENBQUMsU0FBVTtZQUNuRCxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLE1BQU0sT0FBTyxJQUFJO1lBQ3pDLElBQUksQ0FBQyxNQUFNO2NBQ1QsV0FBVyxPQUFPLENBQUM7WUFDckIsT0FBTztjQUNMO2NBQ0EsUUFBUSxNQUFNLENBQUMsQ0FBQyxLQUFLO1lBQ3ZCO1VBQ0Y7UUFDRjtRQUNBLFdBQVcsS0FBSztNQUNsQixFQUFFLE9BQU8sR0FBRztRQUNWLFdBQVcsS0FBSyxDQUFDO01BQ25CO0lBQ0Y7RUFDRjtBQUNGIn0=