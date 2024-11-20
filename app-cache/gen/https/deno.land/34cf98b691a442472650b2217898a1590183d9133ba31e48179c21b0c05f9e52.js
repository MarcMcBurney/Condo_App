// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
import { createLPS } from "./_common.ts";
/** Transform a stream into a stream where each chunk is divided by a given delimiter.
 *
 * ```ts
 * import { TextDelimiterStream } from "https://deno.land/std@$STD_VERSION/streams/text_delimiter_stream.ts";
 * const res = await fetch("https://example.com");
 * const parts = res.body!
 *   .pipeThrough(new TextDecoderStream())
 *   .pipeThrough(new TextDelimiterStream("foo"));
 * ```
 */ export class TextDelimiterStream extends TransformStream {
  #buf = "";
  #delimiter;
  #inspectIndex = 0;
  #matchIndex = 0;
  #delimLPS;
  #disp;
  constructor(delimiter, options){
    super({
      transform: (chunk, controller)=>{
        this.#handle(chunk, controller);
      },
      flush: (controller)=>{
        controller.enqueue(this.#buf);
      }
    });
    this.#delimiter = delimiter;
    this.#delimLPS = createLPS(new TextEncoder().encode(delimiter));
    this.#disp = options?.disposition ?? "discard";
  }
  #handle(chunk, controller) {
    this.#buf += chunk;
    let localIndex = 0;
    while(this.#inspectIndex < this.#buf.length){
      if (chunk[localIndex] === this.#delimiter[this.#matchIndex]) {
        this.#inspectIndex++;
        localIndex++;
        this.#matchIndex++;
        if (this.#matchIndex === this.#delimiter.length) {
          // Full match
          const start = this.#inspectIndex - this.#delimiter.length;
          const end = this.#disp === "suffix" ? this.#inspectIndex : start;
          const copy = this.#buf.slice(0, end);
          controller.enqueue(copy);
          const shift = this.#disp == "prefix" ? start : this.#inspectIndex;
          this.#buf = this.#buf.slice(shift);
          this.#inspectIndex = this.#disp == "prefix" ? this.#delimiter.length : 0;
          this.#matchIndex = 0;
        }
      } else {
        if (this.#matchIndex === 0) {
          this.#inspectIndex++;
          localIndex++;
        } else {
          this.#matchIndex = this.#delimLPS[this.#matchIndex - 1];
        }
      }
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL3N0cmVhbXMvdGV4dF9kZWxpbWl0ZXJfc3RyZWFtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjMgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUaGlzIG1vZHVsZSBpcyBicm93c2VyIGNvbXBhdGlibGUuXG5cbmltcG9ydCB7IGNyZWF0ZUxQUyB9IGZyb20gXCIuL19jb21tb24udHNcIjtcblxuaW1wb3J0IHR5cGUge1xuICBEZWxpbWl0ZXJEaXNwb3NpdGlvbixcbiAgRGVsaW1pdGVyU3RyZWFtT3B0aW9ucyxcbn0gZnJvbSBcIi4vZGVsaW1pdGVyX3N0cmVhbS50c1wiO1xuXG4vKiogVHJhbnNmb3JtIGEgc3RyZWFtIGludG8gYSBzdHJlYW0gd2hlcmUgZWFjaCBjaHVuayBpcyBkaXZpZGVkIGJ5IGEgZ2l2ZW4gZGVsaW1pdGVyLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBUZXh0RGVsaW1pdGVyU3RyZWFtIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vc3RyZWFtcy90ZXh0X2RlbGltaXRlcl9zdHJlYW0udHNcIjtcbiAqIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKFwiaHR0cHM6Ly9leGFtcGxlLmNvbVwiKTtcbiAqIGNvbnN0IHBhcnRzID0gcmVzLmJvZHkhXG4gKiAgIC5waXBlVGhyb3VnaChuZXcgVGV4dERlY29kZXJTdHJlYW0oKSlcbiAqICAgLnBpcGVUaHJvdWdoKG5ldyBUZXh0RGVsaW1pdGVyU3RyZWFtKFwiZm9vXCIpKTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgVGV4dERlbGltaXRlclN0cmVhbSBleHRlbmRzIFRyYW5zZm9ybVN0cmVhbTxzdHJpbmcsIHN0cmluZz4ge1xuICAjYnVmID0gXCJcIjtcbiAgI2RlbGltaXRlcjogc3RyaW5nO1xuICAjaW5zcGVjdEluZGV4ID0gMDtcbiAgI21hdGNoSW5kZXggPSAwO1xuICAjZGVsaW1MUFM6IFVpbnQ4QXJyYXk7XG4gICNkaXNwOiBEZWxpbWl0ZXJEaXNwb3NpdGlvbjtcblxuICBjb25zdHJ1Y3RvcihkZWxpbWl0ZXI6IHN0cmluZywgb3B0aW9ucz86IERlbGltaXRlclN0cmVhbU9wdGlvbnMpIHtcbiAgICBzdXBlcih7XG4gICAgICB0cmFuc2Zvcm06IChjaHVuaywgY29udHJvbGxlcikgPT4ge1xuICAgICAgICB0aGlzLiNoYW5kbGUoY2h1bmssIGNvbnRyb2xsZXIpO1xuICAgICAgfSxcbiAgICAgIGZsdXNoOiAoY29udHJvbGxlcikgPT4ge1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUodGhpcy4jYnVmKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLiNkZWxpbWl0ZXIgPSBkZWxpbWl0ZXI7XG4gICAgdGhpcy4jZGVsaW1MUFMgPSBjcmVhdGVMUFMobmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKGRlbGltaXRlcikpO1xuICAgIHRoaXMuI2Rpc3AgPSBvcHRpb25zPy5kaXNwb3NpdGlvbiA/PyBcImRpc2NhcmRcIjtcbiAgfVxuXG4gICNoYW5kbGUoXG4gICAgY2h1bms6IHN0cmluZyxcbiAgICBjb250cm9sbGVyOiBUcmFuc2Zvcm1TdHJlYW1EZWZhdWx0Q29udHJvbGxlcjxzdHJpbmc+LFxuICApIHtcbiAgICB0aGlzLiNidWYgKz0gY2h1bms7XG4gICAgbGV0IGxvY2FsSW5kZXggPSAwO1xuICAgIHdoaWxlICh0aGlzLiNpbnNwZWN0SW5kZXggPCB0aGlzLiNidWYubGVuZ3RoKSB7XG4gICAgICBpZiAoY2h1bmtbbG9jYWxJbmRleF0gPT09IHRoaXMuI2RlbGltaXRlclt0aGlzLiNtYXRjaEluZGV4XSkge1xuICAgICAgICB0aGlzLiNpbnNwZWN0SW5kZXgrKztcbiAgICAgICAgbG9jYWxJbmRleCsrO1xuICAgICAgICB0aGlzLiNtYXRjaEluZGV4Kys7XG4gICAgICAgIGlmICh0aGlzLiNtYXRjaEluZGV4ID09PSB0aGlzLiNkZWxpbWl0ZXIubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gRnVsbCBtYXRjaFxuICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy4jaW5zcGVjdEluZGV4IC0gdGhpcy4jZGVsaW1pdGVyLmxlbmd0aDtcbiAgICAgICAgICBjb25zdCBlbmQgPSB0aGlzLiNkaXNwID09PSBcInN1ZmZpeFwiID8gdGhpcy4jaW5zcGVjdEluZGV4IDogc3RhcnQ7XG4gICAgICAgICAgY29uc3QgY29weSA9IHRoaXMuI2J1Zi5zbGljZSgwLCBlbmQpO1xuICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShjb3B5KTtcbiAgICAgICAgICBjb25zdCBzaGlmdCA9IHRoaXMuI2Rpc3AgPT0gXCJwcmVmaXhcIiA/IHN0YXJ0IDogdGhpcy4jaW5zcGVjdEluZGV4O1xuICAgICAgICAgIHRoaXMuI2J1ZiA9IHRoaXMuI2J1Zi5zbGljZShzaGlmdCk7XG4gICAgICAgICAgdGhpcy4jaW5zcGVjdEluZGV4ID0gdGhpcy4jZGlzcCA9PSBcInByZWZpeFwiXG4gICAgICAgICAgICA/IHRoaXMuI2RlbGltaXRlci5sZW5ndGhcbiAgICAgICAgICAgIDogMDtcbiAgICAgICAgICB0aGlzLiNtYXRjaEluZGV4ID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuI21hdGNoSW5kZXggPT09IDApIHtcbiAgICAgICAgICB0aGlzLiNpbnNwZWN0SW5kZXgrKztcbiAgICAgICAgICBsb2NhbEluZGV4Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy4jbWF0Y2hJbmRleCA9IHRoaXMuI2RlbGltTFBTW3RoaXMuI21hdGNoSW5kZXggLSAxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBFQUEwRTtBQUMxRSxxQ0FBcUM7QUFFckMsU0FBUyxTQUFTLFFB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