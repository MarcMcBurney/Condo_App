// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
/** Provides a iterable map interfaces for managing cookies server side.
 *
 * @example
 * To access the keys in a request and have any set keys available for creating
 * a response:
 *
 * ```ts
 * import {
 *   CookieMap,
 *   mergeHeaders
 * } from "https://deno.land/std@$STD_VERSION/http/cookie_map.ts";
 *
 * const request = new Request("https://localhost/", {
 *   headers: { "cookie": "foo=bar; bar=baz;"}
 * });
 *
 * const cookies = new CookieMap(request, { secure: true });
 * console.log(cookies.get("foo")); // logs "bar"
 * cookies.set("session", "1234567", { secure: true });
 *
 * const response = new Response("hello", {
 *   headers: mergeHeaders({
 *     "content-type": "text/plain",
 *   }, cookies),
 * });
 * ```
 *
 * @example
 * To have automatic management of cryptographically signed cookies, you can use
 * the {@linkcode SecureCookieMap} instead of {@linkcode CookieMap}. The biggest
 * difference is that the methods operate async in order to be able to support
 * async signing and validation of cookies:
 *
 * ```ts
 * import {
 *   SecureCookieMap,
 *   mergeHeaders,
 *   type KeyRing,
 * } from "https://deno.land/std@$STD_VERSION/http/cookie_map.ts";
 *
 * const request = new Request("https://localhost/", {
 *   headers: { "cookie": "foo=bar; bar=baz;"}
 * });
 *
 * // The keys must implement the `KeyRing` interface.
 * declare const keys: KeyRing;
 *
 * const cookies = new SecureCookieMap(request, { keys, secure: true });
 * console.log(await cookies.get("foo")); // logs "bar"
 * // the cookie will be automatically signed using the supplied key ring.
 * await cookies.set("session", "1234567");
 *
 * const response = new Response("hello", {
 *   headers: mergeHeaders({
 *     "content-type": "text/plain",
 *   }, cookies),
 * });
 * ```
 *
 * In addition, if you have a {@linkcode Response} or {@linkcode Headers} for a
 * response at construction of the cookies object, they can be passed and any
 * set cookies will be added directly to those headers:
 *
 * ```ts
 * import { CookieMap } from "https://deno.land/std@$STD_VERSION/http/cookie_map.ts";
 *
 * const request = new Request("https://localhost/", {
 *   headers: { "cookie": "foo=bar; bar=baz;"}
 * });
 *
 * const response = new Response("hello", {
 *   headers: { "content-type": "text/plain" },
 * });
 *
 * const cookies = new CookieMap(request, { response });
 * console.log(cookies.get("foo")); // logs "bar"
 * cookies.set("session", "1234567");
 * ```
 *
 * @module
 */ // deno-lint-ignore no-control-regex
const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const KEY_REGEXP = /(?:^|;) *([^=]*)=[^;]*/g;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;
const matchCache = {};
function getPattern(name) {
  if (name in matchCache) {
    return matchCache[name];
  }
  return matchCache[name] = new RegExp(`(?:^|;) *${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`);
}
function pushCookie(values, cookie) {
  if (cookie.overwrite) {
    for(let i = values.length - 1; i >= 0; i--){
      if (values[i].indexOf(`${cookie.name}=`) === 0) {
        values.splice(i, 1);
      }
    }
  }
  values.push(cookie.toHeaderValue());
}
function validateCookieProperty(key, value) {
  if (value && !FIELD_CONTENT_REGEXP.test(value)) {
    throw new TypeError(`The "${key}" of the cookie (${value}) is invalid.`);
  }
}
/** An internal abstraction to manage cookies. */ class Cookie {
  domain;
  expires;
  httpOnly = true;
  maxAge;
  name;
  overwrite = false;
  path = "/";
  sameSite = false;
  secure = false;
  signed;
  value;
  constructor(name, value, attributes){
    validateCookieProperty("name", name);
    this.name = name;
    validateCookieProperty("value", value);
    this.value = value ?? "";
    Object.assign(this, attributes);
    if (!this.value) {
      this.expires = new Date(0);
      this.maxAge = undefined;
    }
    validateCookieProperty("path", this.path);
    validateCookieProperty("domain", this.domain);
    if (this.sameSite && typeof this.sameSite === "string" && !SAME_SITE_REGEXP.test(this.sameSite)) {
      throw new TypeError(`The "sameSite" of the cookie ("${this.sameSite}") is invalid.`);
    }
  }
  toHeaderValue() {
    let value = this.toString();
    if (this.maxAge) {
      this.expires = new Date(Date.now() + this.maxAge * 1000);
    }
    if (this.path) {
      value += `; path=${this.path}`;
    }
    if (this.expires) {
      value += `; expires=${this.expires.toUTCString()}`;
    }
    if (this.domain) {
      value += `; domain=${this.domain}`;
    }
    if (this.sameSite) {
      value += `; samesite=${this.sameSite === true ? "strict" : this.sameSite.toLowerCase()}`;
    }
    if (this.secure) {
      value += "; secure";
    }
    if (this.httpOnly) {
      value += "; httponly";
    }
    return value;
  }
  toString() {
    return `${this.name}=${this.value}`;
  }
}
/** Symbol which is used in {@link mergeHeaders} to extract a
 * `[string | string][]` from an instance to generate the final set of
 * headers. */ export const cookieMapHeadersInitSymbol = Symbol.for("Deno.std.cookieMap.headersInit");
function isMergeable(value) {
  return value != null && typeof value === "object" && cookieMapHeadersInitSymbol in value;
}
/** Allows merging of various sources of headers into a final set of headers
 * which can be used in a {@linkcode Response}.
 *
 * Note, that unlike when passing a `Response` or {@linkcode Headers} used in a
 * response to {@linkcode CookieMap} or {@linkcode SecureCookieMap}, merging
 * will not ensure that there are no other `Set-Cookie` headers from other
 * sources, it will simply append the various headers together. */ export function mergeHeaders(...sources) {
  const headers = new Headers();
  for (const source of sources){
    let entries;
    if (source instanceof Headers) {
      entries = source;
    } else if ("headers" in source && source.headers instanceof Headers) {
      entries = source.headers;
    } else if (isMergeable(source)) {
      entries = source[cookieMapHeadersInitSymbol]();
    } else if (Array.isArray(source)) {
      entries = source;
    } else {
      entries = Object.entries(source);
    }
    for (const [key, value] of entries){
      headers.append(key, value);
    }
  }
  return headers;
}
const keys = Symbol("#keys");
const requestHeaders = Symbol("#requestHeaders");
const responseHeaders = Symbol("#responseHeaders");
const isSecure = Symbol("#secure");
const requestKeys = Symbol("#requestKeys");
/** An internal abstract class which provides common functionality for
 * {@link CookieMap} and {@link SecureCookieMap}. */ class CookieMapBase {
  [keys];
  [requestHeaders];
  [responseHeaders];
  [isSecure];
  [requestKeys]() {
    if (this[keys]) {
      return this[keys];
    }
    const result = this[keys] = [];
    const header = this[requestHeaders].get("cookie");
    if (!header) {
      return result;
    }
    let matches;
    while(matches = KEY_REGEXP.exec(header)){
      const [, key] = matches;
      result.push(key);
    }
    return result;
  }
  constructor(request, options){
    this[requestHeaders] = "headers" in request ? request.headers : request;
    const { secure = false, response = new Headers() } = options;
    this[responseHeaders] = "headers" in response ? response.headers : response;
    this[isSecure] = secure;
  }
  /** A method used by {@linkcode mergeHeaders} to be able to merge
   * headers from various sources when forming a {@linkcode Response}. */ [cookieMapHeadersInitSymbol]() {
    const init = [];
    for (const [key, value] of this[responseHeaders]){
      if (key === "set-cookie") {
        init.push([
          key,
          value
        ]);
      }
    }
    return init;
  }
  [Symbol.for("Deno.customInspect")]() {
    return `${this.constructor.name} []`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](depth, // deno-lint-ignore no-explicit-any
  options, inspect) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }
    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1
    });
    return `${options.stylize(this.constructor.name, "special")} ${inspect([], newOptions)}`;
  }
}
/**
 * Provides a way to manage cookies in a request and response on the server
 * as a single iterable collection.
 *
 * The methods and properties align to {@linkcode Map}. When constructing a
 * {@linkcode Request} or {@linkcode Headers} from the request need to be
 * provided, as well as optionally the {@linkcode Response} or `Headers` for the
 * response can be provided. Alternatively the {@linkcode mergeHeaders}
 * function can be used to generate a final set of headers for sending in the
 * response. */ export class CookieMap extends CookieMapBase {
  /** Contains the number of valid cookies in the request headers. */ get size() {
    return [
      ...this
    ].length;
  }
  constructor(request, options = {}){
    super(request, options);
  }
  /** Deletes all the cookies from the {@linkcode Request} in the response. */ clear(options = {}) {
    for (const key of this.keys()){
      this.set(key, null, options);
    }
  }
  /** Set a cookie to be deleted in the response.
   *
   * This is a convenience function for `set(key, null, options?)`.
   */ delete(key, options = {}) {
    this.set(key, null, options);
    return true;
  }
  /** Return the value of a matching key present in the {@linkcode Request}. If
   * the key is not present `undefined` is returned. */ get(key) {
    const headerValue = this[requestHeaders].get("cookie");
    if (!headerValue) {
      return undefined;
    }
    const match = headerValue.match(getPattern(key));
    if (!match) {
      return undefined;
    }
    const [, value] = match;
    return value;
  }
  /** Returns `true` if the matching key is present in the {@linkcode Request},
   * otherwise `false`. */ has(key) {
    const headerValue = this[requestHeaders].get("cookie");
    if (!headerValue) {
      return false;
    }
    return getPattern(key).test(headerValue);
  }
  /** Set a named cookie in the response. The optional
   * {@linkcode CookieMapSetDeleteOptions} are applied to the cookie being set.
   */ set(key, value, options = {}) {
    const resHeaders = this[responseHeaders];
    const values = [];
    for (const [key, value] of resHeaders){
      if (key === "set-cookie") {
        values.push(value);
      }
    }
    const secure = this[isSecure];
    if (!secure && options.secure && !options.ignoreInsecure) {
      throw new TypeError("Cannot send secure cookie over unencrypted connection.");
    }
    const cookie = new Cookie(key, value, options);
    cookie.secure = options.secure ?? secure;
    pushCookie(values, cookie);
    resHeaders.delete("set-cookie");
    for (const value of values){
      resHeaders.append("set-cookie", value);
    }
    return this;
  }
  /** Iterate over the cookie keys and values that are present in the
   * {@linkcode Request}. This is an alias of the `[Symbol.iterator]` method
   * present on the class. */ entries() {
    return this[Symbol.iterator]();
  }
  /** Iterate over the cookie keys that are present in the
   * {@linkcode Request}. */ *keys() {
    for (const [key] of this){
      yield key;
    }
  }
  /** Iterate over the cookie values that are present in the
   * {@linkcode Request}. */ *values() {
    for (const [, value] of this){
      yield value;
    }
  }
  /** Iterate over the cookie keys and values that are present in the
   * {@linkcode Request}. */ *[Symbol.iterator]() {
    const keys = this[requestKeys]();
    for (const key of keys){
      const value = this.get(key);
      if (value) {
        yield [
          key,
          value
        ];
      }
    }
  }
}
/** Provides an way to manage cookies in a request and response on the server
 * as a single iterable collection, as well as the ability to sign and verify
 * cookies to prevent tampering.
 *
 * The methods and properties align to {@linkcode Map}, but due to the need to
 * support asynchronous cryptographic keys, all the APIs operate async. When
 * constructing a {@linkcode Request} or {@linkcode Headers} from the request
 * need to be provided, as well as optionally the {@linkcode Response} or
 * `Headers` for the response can be provided. Alternatively the
 * {@linkcode mergeHeaders} function can be used to generate a final set
 * of headers for sending in the response.
 *
 * On construction, the optional set of keys implementing the
 * {@linkcode KeyRing} interface. While it is optional, if you don't plan to use
 * keys, you might want to consider using just the {@linkcode CookieMap}.
 *
 * @example
 */ export class SecureCookieMap extends CookieMapBase {
  #keyRing;
  /** Is set to a promise which resolves with the number of cookies in the
   * {@linkcode Request}. */ get size() {
    return (async ()=>{
      let size = 0;
      for await (const _ of this){
        size++;
      }
      return size;
    })();
  }
  constructor(request, options = {}){
    super(request, options);
    const { keys } = options;
    this.#keyRing = keys;
  }
  /** Sets all cookies in the {@linkcode Request} to be deleted in the
   * response. */ async clear(options) {
    for await (const key of this.keys()){
      await this.set(key, null, options);
    }
  }
  /** Set a cookie to be deleted in the response.
   *
   * This is a convenience function for `set(key, null, options?)`. */ async delete(key, options = {}) {
    await this.set(key, null, options);
    return true;
  }
  /** Get the value of a cookie from the {@linkcode Request}.
   *
   * If the cookie is signed, and the signature is invalid, `undefined` will be
   * returned and the cookie will be set to be deleted in the response. If the
   * cookie is using an "old" key from the keyring, the cookie will be re-signed
   * with the current key and be added to the response to be updated. */ async get(key, options = {}) {
    const signed = options.signed ?? !!this.#keyRing;
    const nameSig = `${key}.sig`;
    const header = this[requestHeaders].get("cookie");
    if (!header) {
      return;
    }
    const match = header.match(getPattern(key));
    if (!match) {
      return;
    }
    const [, value] = match;
    if (!signed) {
      return value;
    }
    const digest = await this.get(nameSig, {
      signed: false
    });
    if (!digest) {
      return;
    }
    const data = `${key}=${value}`;
    if (!this.#keyRing) {
      throw new TypeError("key ring required for signed cookies");
    }
    const index = await this.#keyRing.indexOf(data, digest);
    if (index < 0) {
      await this.delete(nameSig, {
        path: "/",
        signed: false
      });
    } else {
      if (index) {
        await this.set(nameSig, await this.#keyRing.sign(data), {
          signed: false
        });
      }
      return value;
    }
  }
  /** Returns `true` if the key is in the {@linkcode Request}.
   *
   * If the cookie is signed, and the signature is invalid, `false` will be
   * returned and the cookie will be set to be deleted in the response. If the
   * cookie is using an "old" key from the keyring, the cookie will be re-signed
   * with the current key and be added to the response to be updated. */ async has(key, options = {}) {
    const signed = options.signed ?? !!this.#keyRing;
    const nameSig = `${key}.sig`;
    const header = this[requestHeaders].get("cookie");
    if (!header) {
      return false;
    }
    const match = header.match(getPattern(key));
    if (!match) {
      return false;
    }
    if (!signed) {
      return true;
    }
    const digest = await this.get(nameSig, {
      signed: false
    });
    if (!digest) {
      return false;
    }
    const [, value] = match;
    const data = `${key}=${value}`;
    if (!this.#keyRing) {
      throw new TypeError("key ring required for signed cookies");
    }
    const index = await this.#keyRing.indexOf(data, digest);
    if (index < 0) {
      await this.delete(nameSig, {
        path: "/",
        signed: false
      });
      return false;
    } else {
      if (index) {
        await this.set(nameSig, await this.#keyRing.sign(data), {
          signed: false
        });
      }
      return true;
    }
  }
  /** Set a cookie in the response headers.
   *
   * If there was a keyring set, cookies will be automatically signed, unless
   * overridden by the passed options. Cookies can be deleted by setting the
   * value to `null`. */ async set(key, value, options = {}) {
    const resHeaders = this[responseHeaders];
    const headers = [];
    for (const [key, value] of resHeaders.entries()){
      if (key === "set-cookie") {
        headers.push(value);
      }
    }
    const secure = this[isSecure];
    const signed = options.signed ?? !!this.#keyRing;
    if (!secure && options.secure && !options.ignoreInsecure) {
      throw new TypeError("Cannot send secure cookie over unencrypted connection.");
    }
    const cookie = new Cookie(key, value, options);
    cookie.secure = options.secure ?? secure;
    pushCookie(headers, cookie);
    if (signed) {
      if (!this.#keyRing) {
        throw new TypeError("keys required for signed cookies.");
      }
      cookie.value = await this.#keyRing.sign(cookie.toString());
      cookie.name += ".sig";
      pushCookie(headers, cookie);
    }
    resHeaders.delete("set-cookie");
    for (const header of headers){
      resHeaders.append("set-cookie", header);
    }
    return this;
  }
  /** Iterate over the {@linkcode Request} cookies, yielding up a tuple
   * containing the key and value of each cookie.
   *
   * If a key ring was provided, only properly signed cookie keys and values are
   * returned. */ entries() {
    return this[Symbol.asyncIterator]();
  }
  /** Iterate over the request's cookies, yielding up the key of each cookie.
   *
   * If a keyring was provided, only properly signed cookie keys are
   * returned. */ async *keys() {
    for await (const [key] of this){
      yield key;
    }
  }
  /** Iterate over the request's cookies, yielding up the value of each cookie.
   *
   * If a keyring was provided, only properly signed cookie values are
   * returned. */ async *values() {
    for await (const [, value] of this){
      yield value;
    }
  }
  /** Iterate over the {@linkcode Request} cookies, yielding up a tuple
   * containing the key and value of each cookie.
   *
   * If a key ring was provided, only properly signed cookie keys and values are
   * returned. */ async *[Symbol.asyncIterator]() {
    const keys = this[requestKeys]();
    for (const key of keys){
      const value = await this.get(key);
      if (value) {
        yield [
          key,
          value
        ];
      }
    }
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2h0dHAvY29va2llX21hcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIzIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vKiogUHJvdmlkZXMgYSBpdGVyYWJsZSBtYXAgaW50ZXJmYWNlcyBmb3IgbWFuYWdpbmcgY29va2llcyBzZXJ2ZXIgc2lkZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogVG8gYWNjZXNzIHRoZSBrZXlzIGluIGEgcmVxdWVzdCBhbmQgaGF2ZSBhbnkgc2V0IGtleXMgYXZhaWxhYmxlIGZvciBjcmVhdGluZ1xuICogYSByZXNwb25zZTpcbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHtcbiAqICAgQ29va2llTWFwLFxuICogICBtZXJnZUhlYWRlcnNcbiAqIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9jb29raWVfbWFwLnRzXCI7XG4gKlxuICogY29uc3QgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KFwiaHR0cHM6Ly9sb2NhbGhvc3QvXCIsIHtcbiAqICAgaGVhZGVyczogeyBcImNvb2tpZVwiOiBcImZvbz1iYXI7IGJhcj1iYXo7XCJ9XG4gKiB9KTtcbiAqXG4gKiBjb25zdCBjb29raWVzID0gbmV3IENvb2tpZU1hcChyZXF1ZXN0LCB7IHNlY3VyZTogdHJ1ZSB9KTtcbiAqIGNvbnNvbGUubG9nKGNvb2tpZXMuZ2V0KFwiZm9vXCIpKTsgLy8gbG9ncyBcImJhclwiXG4gKiBjb29raWVzLnNldChcInNlc3Npb25cIiwgXCIxMjM0NTY3XCIsIHsgc2VjdXJlOiB0cnVlIH0pO1xuICpcbiAqIGNvbnN0IHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKFwiaGVsbG9cIiwge1xuICogICBoZWFkZXJzOiBtZXJnZUhlYWRlcnMoe1xuICogICAgIFwiY29udGVudC10eXBlXCI6IFwidGV4dC9wbGFpblwiLFxuICogICB9LCBjb29raWVzKSxcbiAqIH0pO1xuICogYGBgXG4gKlxuICogQGV4YW1wbGVcbiAqIFRvIGhhdmUgYXV0b21hdGljIG1hbmFnZW1lbnQgb2YgY3J5cHRvZ3JhcGhpY2FsbHkgc2lnbmVkIGNvb2tpZXMsIHlvdSBjYW4gdXNlXG4gKiB0aGUge0BsaW5rY29kZSBTZWN1cmVDb29raWVNYXB9IGluc3RlYWQgb2Yge0BsaW5rY29kZSBDb29raWVNYXB9LiBUaGUgYmlnZ2VzdFxuICogZGlmZmVyZW5jZSBpcyB0aGF0IHRoZSBtZXRob2RzIG9wZXJhdGUgYXN5bmMgaW4gb3JkZXIgdG8gYmUgYWJsZSB0byBzdXBwb3J0XG4gKiBhc3luYyBzaWduaW5nIGFuZCB2YWxpZGF0aW9uIG9mIGNvb2tpZXM6XG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7XG4gKiAgIFNlY3VyZUNvb2tpZU1hcCxcbiAqICAgbWVyZ2VIZWFkZXJzLFxuICogICB0eXBlIEtleVJpbmcsXG4gKiB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvY29va2llX21hcC50c1wiO1xuICpcbiAqIGNvbnN0IHJlcXVlc3QgPSBuZXcgUmVxdWVzdChcImh0dHBzOi8vbG9jYWxob3N0L1wiLCB7XG4gKiAgIGhlYWRlcnM6IHsgXCJjb29raWVcIjogXCJmb289YmFyOyBiYXI9YmF6O1wifVxuICogfSk7XG4gKlxuICogLy8gVGhlIGtleXMgbXVzdCBpbXBsZW1lbnQgdGhlIGBLZXlSaW5nYCBpbnRlcmZhY2UuXG4gKiBkZWNsYXJlIGNvbnN0IGtleXM6IEtleVJpbmc7XG4gKlxuICogY29uc3QgY29va2llcyA9IG5ldyBTZWN1cmVDb29raWVNYXAocmVxdWVzdCwgeyBrZXlzLCBzZWN1cmU6IHRydWUgfSk7XG4gKiBjb25zb2xlLmxvZyhhd2FpdCBjb29raWVzLmdldChcImZvb1wiKSk7IC8vIGxvZ3MgXCJiYXJcIlxuICogLy8gdGhlIGNvb2tpZSB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgc2lnbmVkIHVzaW5nIHRoZSBzdXBwbGllZCBrZXkgcmluZy5cbiAqIGF3YWl0IGNvb2tpZXMuc2V0KFwic2Vzc2lvblwiLCBcIjEyMzQ1NjdcIik7XG4gKlxuICogY29uc3QgcmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UoXCJoZWxsb1wiLCB7XG4gKiAgIGhlYWRlcnM6IG1lcmdlSGVhZGVycyh7XG4gKiAgICAgXCJjb250ZW50LXR5cGVcIjogXCJ0ZXh0L3BsYWluXCIsXG4gKiAgIH0sIGNvb2tpZXMpLFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBJbiBhZGRpdGlvbiwgaWYgeW91IGhhdmUgYSB7QGxpbmtjb2RlIFJlc3BvbnNlfSBvciB7QGxpbmtjb2RlIEhlYWRlcnN9IGZvciBhXG4gKiByZXNwb25zZSBhdCBjb25zdHJ1Y3Rpb24gb2YgdGhlIGNvb2tpZXMgb2JqZWN0LCB0aGV5IGNhbiBiZSBwYXNzZWQgYW5kIGFueVxuICogc2V0IGNvb2tpZXMgd2lsbCBiZSBhZGRlZCBkaXJlY3RseSB0byB0aG9zZSBoZWFkZXJzOlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBDb29raWVNYXAgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9odHRwL2Nvb2tpZV9tYXAudHNcIjtcbiAqXG4gKiBjb25zdCByZXF1ZXN0ID0gbmV3IFJlcXVlc3QoXCJodHRwczovL2xvY2FsaG9zdC9cIiwge1xuICogICBoZWFkZXJzOiB7IFwiY29va2llXCI6IFwiZm9vPWJhcjsgYmFyPWJhejtcIn1cbiAqIH0pO1xuICpcbiAqIGNvbnN0IHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKFwiaGVsbG9cIiwge1xuICogICBoZWFkZXJzOiB7IFwiY29udGVudC10eXBlXCI6IFwidGV4dC9wbGFpblwiIH0sXG4gKiB9KTtcbiAqXG4gKiBjb25zdCBjb29raWVzID0gbmV3IENvb2tpZU1hcChyZXF1ZXN0LCB7IHJlc3BvbnNlIH0pO1xuICogY29uc29sZS5sb2coY29va2llcy5nZXQoXCJmb29cIikpOyAvLyBsb2dzIFwiYmFyXCJcbiAqIGNvb2tpZXMuc2V0KFwic2Vzc2lvblwiLCBcIjEyMzQ1NjdcIik7XG4gKiBgYGBcbiAqXG4gKiBAbW9kdWxlXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBDb29raWVNYXBPcHRpb25zIHtcbiAgLyoqIFRoZSB7QGxpbmtjb2RlIFJlc3BvbnNlfSBvciB0aGUgaGVhZGVycyB0aGF0IHdpbGwgYmUgdXNlZCB3aXRoIHRoZVxuICAgKiByZXNwb25zZS4gV2hlbiBwcm92aWRlZCwgYFNldC1Db29raWVgIGhlYWRlcnMgd2lsbCBiZSBzZXQgaW4gdGhlIGhlYWRlcnNcbiAgICogd2hlbiBjb29raWVzIGFyZSBzZXQgb3IgZGVsZXRlZCBpbiB0aGUgbWFwLlxuICAgKlxuICAgKiBBbiBhbHRlcm5hdGl2ZSB3YXkgdG8gZXh0cmFjdCB0aGUgaGVhZGVycyBpcyB0byBwYXNzIHRoZSBjb29raWUgbWFwIHRvIHRoZVxuICAgKiB7QGxpbmtjb2RlIG1lcmdlSGVhZGVyc30gZnVuY3Rpb24gdG8gbWVyZ2UgdmFyaW91cyBzb3VyY2VzIG9mIHRoZVxuICAgKiBoZWFkZXJzIHRvIGJlIHByb3ZpZGVkIHdoZW4gY3JlYXRpbmcgb3IgdXBkYXRpbmcgYSByZXNwb25zZS5cbiAgICovXG4gIHJlc3BvbnNlPzogSGVhZGVyZWQgfCBIZWFkZXJzO1xuICAvKiogQSBmbGFnIHRoYXQgaW5kaWNhdGVzIGlmIHRoZSByZXF1ZXN0IGFuZCByZXNwb25zZSBhcmUgYmVpbmcgaGFuZGxlZCBvdmVyXG4gICAqIGEgc2VjdXJlIChlLmcuIEhUVFBTL1RMUykgY29ubmVjdGlvbi5cbiAgICpcbiAgICogQGRlZmF1bHQge2ZhbHNlfVxuICAgKi9cbiAgc2VjdXJlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb29raWVNYXBTZXREZWxldGVPcHRpb25zIHtcbiAgLyoqIFRoZSBkb21haW4gdG8gc2NvcGUgdGhlIGNvb2tpZSBmb3IuICovXG4gIGRvbWFpbj86IHN0cmluZztcbiAgLyoqIFdoZW4gdGhlIGNvb2tpZSBleHBpcmVzLiAqL1xuICBleHBpcmVzPzogRGF0ZTtcbiAgLyoqIE51bWJlciBvZiBzZWNvbmRzIHVudGlsIHRoZSBjb29raWUgZXhwaXJlcyAqL1xuICBtYXhBZ2U/OiBudW1iZXI7XG4gIC8qKiBBIGZsYWcgdGhhdCBpbmRpY2F0ZXMgaWYgdGhlIGNvb2tpZSBpcyB2YWxpZCBvdmVyIEhUVFAgb25seS4gKi9cbiAgaHR0cE9ubHk/OiBib29sZWFuO1xuICAvKiogRG8gbm90IGVycm9yIHdoZW4gc2lnbmluZyBhbmQgdmFsaWRhdGluZyBjb29raWVzIG92ZXIgYW4gaW5zZWN1cmVcbiAgICogY29ubmVjdGlvbi4gKi9cbiAgaWdub3JlSW5zZWN1cmU/OiBib29sZWFuO1xuICAvKiogT3ZlcndyaXRlIGFuIGV4aXN0aW5nIHZhbHVlLiAqL1xuICBvdmVyd3JpdGU/OiBib29sZWFuO1xuICAvKiogVGhlIHBhdGggdGhlIGNvb2tpZSBpcyB2YWxpZCBmb3IuICovXG4gIHBhdGg/OiBzdHJpbmc7XG4gIC8qKiBPdmVycmlkZSB0aGUgZmxhZyB0aGF0IHdhcyBzZXQgd2hlbiB0aGUgaW5zdGFuY2Ugd2FzIGNyZWF0ZWQuICovXG4gIHNlY3VyZT86IGJvb2xlYW47XG4gIC8qKiBTZXQgdGhlIHNhbWUtc2l0ZSBpbmRpY2F0b3IgZm9yIGEgY29va2llLiAqL1xuICBzYW1lU2l0ZT86IFwic3RyaWN0XCIgfCBcImxheFwiIHwgXCJub25lXCIgfCBib29sZWFuO1xufVxuXG4vKiogQW4gb2JqZWN0IHdoaWNoIGNvbnRhaW5zIGEgYGhlYWRlcnNgIHByb3BlcnR5IHdoaWNoIGhhcyBhIHZhbHVlIG9mIGFuXG4gKiBpbnN0YW5jZSBvZiB7QGxpbmtjb2RlIEhlYWRlcnN9LCBsaWtlIHtAbGlua2NvZGUgUmVxdWVzdH0gYW5kXG4gKiB7QGxpbmtjb2RlIFJlc3BvbnNlfS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSGVhZGVyZWQge1xuICBoZWFkZXJzOiBIZWFkZXJzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1lcmdlYWJsZSB7XG4gIFtjb29raWVNYXBIZWFkZXJzSW5pdFN5bWJvbF0oKTogW3N0cmluZywgc3RyaW5nXVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyZUNvb2tpZU1hcE9wdGlvbnMge1xuICAvKiogS2V5cyB3aGljaCB3aWxsIGJlIHVzZWQgdG8gdmFsaWRhdGUgYW5kIHNpZ24gY29va2llcy4gVGhlIGtleSByaW5nIHNob3VsZFxuICAgKiBpbXBsZW1lbnQgdGhlIHtAbGlua2NvZGUgS2V5UmluZ30gaW50ZXJmYWNlLiAqL1xuICBrZXlzPzogS2V5UmluZztcblxuICAvKiogVGhlIHtAbGlua2NvZGUgUmVzcG9uc2V9IG9yIHRoZSBoZWFkZXJzIHRoYXQgd2lsbCBiZSB1c2VkIHdpdGggdGhlXG4gICAqIHJlc3BvbnNlLiBXaGVuIHByb3ZpZGVkLCBgU2V0LUNvb2tpZWAgaGVhZGVycyB3aWxsIGJlIHNldCBpbiB0aGUgaGVhZGVyc1xuICAgKiB3aGVuIGNvb2tpZXMgYXJlIHNldCBvciBkZWxldGVkIGluIHRoZSBtYXAuXG4gICAqXG4gICAqIEFuIGFsdGVybmF0aXZlIHdheSB0byBleHRyYWN0IHRoZSBoZWFkZXJzIGlzIHRvIHBhc3MgdGhlIGNvb2tpZSBtYXAgdG8gdGhlXG4gICAqIHtAbGlua2NvZGUgbWVyZ2VIZWFkZXJzfSBmdW5jdGlvbiB0byBtZXJnZSB2YXJpb3VzIHNvdXJjZXMgb2YgdGhlXG4gICAqIGhlYWRlcnMgdG8gYmUgcHJvdmlkZWQgd2hlbiBjcmVhdGluZyBvciB1cGRhdGluZyBhIHJlc3BvbnNlLlxuICAgKi9cbiAgcmVzcG9uc2U/OiBIZWFkZXJlZCB8IEhlYWRlcnM7XG5cbiAgLyoqIEEgZmxhZyB0aGF0IGluZGljYXRlcyBpZiB0aGUgcmVxdWVzdCBhbmQgcmVzcG9uc2UgYXJlIGJlaW5nIGhhbmRsZWQgb3ZlclxuICAgKiBhIHNlY3VyZSAoZS5nLiBIVFRQUy9UTFMpIGNvbm5lY3Rpb24uXG4gICAqXG4gICAqIEBkZWZhdWx0IHtmYWxzZX1cbiAgICovXG4gIHNlY3VyZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VjdXJlQ29va2llTWFwR2V0T3B0aW9ucyB7XG4gIC8qKiBPdmVycmlkZXMgdGhlIGZsYWcgdGhhdCB3YXMgc2V0IHdoZW4gdGhlIGluc3RhbmNlIHdhcyBjcmVhdGVkLiAqL1xuICBzaWduZWQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyZUNvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnMge1xuICAvKiogVGhlIGRvbWFpbiB0byBzY29wZSB0aGUgY29va2llIGZvci4gKi9cbiAgZG9tYWluPzogc3RyaW5nO1xuICAvKiogV2hlbiB0aGUgY29va2llIGV4cGlyZXMuICovXG4gIGV4cGlyZXM/OiBEYXRlO1xuICAvKiogTnVtYmVyIG9mIHNlY29uZHMgdW50aWwgdGhlIGNvb2tpZSBleHBpcmVzICovXG4gIG1heEFnZT86IG51bWJlcjtcbiAgLyoqIEEgZmxhZyB0aGF0IGluZGljYXRlcyBpZiB0aGUgY29va2llIGlzIHZhbGlkIG92ZXIgSFRUUCBvbmx5LiAqL1xuICBodHRwT25seT86IGJvb2xlYW47XG4gIC8qKiBEbyBub3QgZXJyb3Igd2hlbiBzaWduaW5nIGFuZCB2YWxpZGF0aW5nIGNvb2tpZXMgb3ZlciBhbiBpbnNlY3VyZVxuICAgKiBjb25uZWN0aW9uLiAqL1xuICBpZ25vcmVJbnNlY3VyZT86IGJvb2xlYW47XG4gIC8qKiBPdmVyd3JpdGUgYW4gZXhpc3RpbmcgdmFsdWUuICovXG4gIG92ZXJ3cml0ZT86IGJvb2xlYW47XG4gIC8qKiBUaGUgcGF0aCB0aGUgY29va2llIGlzIHZhbGlkIGZvci4gKi9cbiAgcGF0aD86IHN0cmluZztcbiAgLyoqIE92ZXJyaWRlIHRoZSBmbGFnIHRoYXQgd2FzIHNldCB3aGVuIHRoZSBpbnN0YW5jZSB3YXMgY3JlYXRlZC4gKi9cbiAgc2VjdXJlPzogYm9vbGVhbjtcbiAgLyoqIFNldCB0aGUgc2FtZS1zaXRlIGluZGljYXRvciBmb3IgYSBjb29raWUuICovXG4gIHNhbWVTaXRlPzogXCJzdHJpY3RcIiB8IFwibGF4XCIgfCBcIm5vbmVcIiB8IGJvb2xlYW47XG4gIC8qKiBPdmVycmlkZSB0aGUgZGVmYXVsdCBiZWhhdmlvciBvZiBzaWduaW5nIHRoZSBjb29raWUuICovXG4gIHNpZ25lZD86IGJvb2xlYW47XG59XG5cbnR5cGUgQ29va2llQXR0cmlidXRlcyA9IFNlY3VyZUNvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnM7XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tY29udHJvbC1yZWdleFxuY29uc3QgRklFTERfQ09OVEVOVF9SRUdFWFAgPSAvXltcXHUwMDA5XFx1MDAyMC1cXHUwMDdlXFx1MDA4MC1cXHUwMGZmXSskLztcbmNvbnN0IEtFWV9SRUdFWFAgPSAvKD86Xnw7KSAqKFtePV0qKT1bXjtdKi9nO1xuY29uc3QgU0FNRV9TSVRFX1JFR0VYUCA9IC9eKD86bGF4fG5vbmV8c3RyaWN0KSQvaTtcblxuY29uc3QgbWF0Y2hDYWNoZTogUmVjb3JkPHN0cmluZywgUmVnRXhwPiA9IHt9O1xuZnVuY3Rpb24gZ2V0UGF0dGVybihuYW1lOiBzdHJpbmcpOiBSZWdFeHAge1xuICBpZiAobmFtZSBpbiBtYXRjaENhY2hlKSB7XG4gICAgcmV0dXJuIG1hdGNoQ2FjaGVbbmFtZV07XG4gIH1cblxuICByZXR1cm4gbWF0Y2hDYWNoZVtuYW1lXSA9IG5ldyBSZWdFeHAoXG4gICAgYCg/Ol58OykgKiR7bmFtZS5yZXBsYWNlKC9bLVtcXF17fSgpKis/LixcXFxcXiR8I1xcc10vZywgXCJcXFxcJCZcIil9PShbXjtdKilgLFxuICApO1xufVxuXG5mdW5jdGlvbiBwdXNoQ29va2llKHZhbHVlczogc3RyaW5nW10sIGNvb2tpZTogQ29va2llKSB7XG4gIGlmIChjb29raWUub3ZlcndyaXRlKSB7XG4gICAgZm9yIChsZXQgaSA9IHZhbHVlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHZhbHVlc1tpXS5pbmRleE9mKGAke2Nvb2tpZS5uYW1lfT1gKSA9PT0gMCkge1xuICAgICAgICB2YWx1ZXMuc3BsaWNlKGksIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YWx1ZXMucHVzaChjb29raWUudG9IZWFkZXJWYWx1ZSgpKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVDb29raWVQcm9wZXJ0eShcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLFxuKSB7XG4gIGlmICh2YWx1ZSAmJiAhRklFTERfQ09OVEVOVF9SRUdFWFAudGVzdCh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUaGUgXCIke2tleX1cIiBvZiB0aGUgY29va2llICgke3ZhbHVlfSkgaXMgaW52YWxpZC5gKTtcbiAgfVxufVxuXG4vKiogQW4gaW50ZXJuYWwgYWJzdHJhY3Rpb24gdG8gbWFuYWdlIGNvb2tpZXMuICovXG5jbGFzcyBDb29raWUgaW1wbGVtZW50cyBDb29raWVBdHRyaWJ1dGVzIHtcbiAgZG9tYWluPzogc3RyaW5nO1xuICBleHBpcmVzPzogRGF0ZTtcbiAgaHR0cE9ubHkgPSB0cnVlO1xuICBtYXhBZ2U/OiBudW1iZXI7XG4gIG5hbWU6IHN0cmluZztcbiAgb3ZlcndyaXRlID0gZmFsc2U7XG4gIHBhdGggPSBcIi9cIjtcbiAgc2FtZVNpdGU6IFwic3RyaWN0XCIgfCBcImxheFwiIHwgXCJub25lXCIgfCBib29sZWFuID0gZmFsc2U7XG4gIHNlY3VyZSA9IGZhbHNlO1xuICBzaWduZWQ/OiBib29sZWFuO1xuICB2YWx1ZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICB2YWx1ZTogc3RyaW5nIHwgbnVsbCxcbiAgICBhdHRyaWJ1dGVzOiBDb29raWVBdHRyaWJ1dGVzLFxuICApIHtcbiAgICB2YWxpZGF0ZUNvb2tpZVByb3BlcnR5KFwibmFtZVwiLCBuYW1lKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHZhbGlkYXRlQ29va2llUHJvcGVydHkoXCJ2YWx1ZVwiLCB2YWx1ZSk7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlID8/IFwiXCI7XG4gICAgT2JqZWN0LmFzc2lnbih0aGlzLCBhdHRyaWJ1dGVzKTtcbiAgICBpZiAoIXRoaXMudmFsdWUpIHtcbiAgICAgIHRoaXMuZXhwaXJlcyA9IG5ldyBEYXRlKDApO1xuICAgICAgdGhpcy5tYXhBZ2UgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVDb29raWVQcm9wZXJ0eShcInBhdGhcIiwgdGhpcy5wYXRoKTtcbiAgICB2YWxpZGF0ZUNvb2tpZVByb3BlcnR5KFwiZG9tYWluXCIsIHRoaXMuZG9tYWluKTtcbiAgICBpZiAoXG4gICAgICB0aGlzLnNhbWVTaXRlICYmIHR5cGVvZiB0aGlzLnNhbWVTaXRlID09PSBcInN0cmluZ1wiICYmXG4gICAgICAhU0FNRV9TSVRFX1JFR0VYUC50ZXN0KHRoaXMuc2FtZVNpdGUpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgVGhlIFwic2FtZVNpdGVcIiBvZiB0aGUgY29va2llIChcIiR7dGhpcy5zYW1lU2l0ZX1cIikgaXMgaW52YWxpZC5gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICB0b0hlYWRlclZhbHVlKCk6IHN0cmluZyB7XG4gICAgbGV0IHZhbHVlID0gdGhpcy50b1N0cmluZygpO1xuICAgIGlmICh0aGlzLm1heEFnZSkge1xuICAgICAgdGhpcy5leHBpcmVzID0gbmV3IERhdGUoRGF0ZS5ub3coKSArICh0aGlzLm1heEFnZSAqIDEwMDApKTtcbiAgICB9XG4gICAgaWYgKHRoaXMucGF0aCkge1xuICAgICAgdmFsdWUgKz0gYDsgcGF0aD0ke3RoaXMucGF0aH1gO1xuICAgIH1cbiAgICBpZiAodGhpcy5leHBpcmVzKSB7XG4gICAgICB2YWx1ZSArPSBgOyBleHBpcmVzPSR7dGhpcy5leHBpcmVzLnRvVVRDU3RyaW5nKCl9YDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZG9tYWluKSB7XG4gICAgICB2YWx1ZSArPSBgOyBkb21haW49JHt0aGlzLmRvbWFpbn1gO1xuICAgIH1cbiAgICBpZiAodGhpcy5zYW1lU2l0ZSkge1xuICAgICAgdmFsdWUgKz0gYDsgc2FtZXNpdGU9JHtcbiAgICAgICAgdGhpcy5zYW1lU2l0ZSA9PT0gdHJ1ZSA/IFwic3RyaWN0XCIgOiB0aGlzLnNhbWVTaXRlLnRvTG93ZXJDYXNlKClcbiAgICAgIH1gO1xuICAgIH1cbiAgICBpZiAodGhpcy5zZWN1cmUpIHtcbiAgICAgIHZhbHVlICs9IFwiOyBzZWN1cmVcIjtcbiAgICB9XG4gICAgaWYgKHRoaXMuaHR0cE9ubHkpIHtcbiAgICAgIHZhbHVlICs9IFwiOyBodHRwb25seVwiO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiBgJHt0aGlzLm5hbWV9PSR7dGhpcy52YWx1ZX1gO1xuICB9XG59XG5cbi8qKiBTeW1ib2wgd2hpY2ggaXMgdXNlZCBpbiB7QGxpbmsgbWVyZ2VIZWFkZXJzfSB0byBleHRyYWN0IGFcbiAqIGBbc3RyaW5nIHwgc3RyaW5nXVtdYCBmcm9tIGFuIGluc3RhbmNlIHRvIGdlbmVyYXRlIHRoZSBmaW5hbCBzZXQgb2ZcbiAqIGhlYWRlcnMuICovXG5leHBvcnQgY29uc3QgY29va2llTWFwSGVhZGVyc0luaXRTeW1ib2wgPSBTeW1ib2wuZm9yKFxuICBcIkRlbm8uc3RkLmNvb2tpZU1hcC5oZWFkZXJzSW5pdFwiLFxuKTtcblxuZnVuY3Rpb24gaXNNZXJnZWFibGUodmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBNZXJnZWFibGUge1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiZcbiAgICBjb29raWVNYXBIZWFkZXJzSW5pdFN5bWJvbCBpbiB2YWx1ZTtcbn1cblxuLyoqIEFsbG93cyBtZXJnaW5nIG9mIHZhcmlvdXMgc291cmNlcyBvZiBoZWFkZXJzIGludG8gYSBmaW5hbCBzZXQgb2YgaGVhZGVyc1xuICogd2hpY2ggY2FuIGJlIHVzZWQgaW4gYSB7QGxpbmtjb2RlIFJlc3BvbnNlfS5cbiAqXG4gKiBOb3RlLCB0aGF0IHVubGlrZSB3aGVuIHBhc3NpbmcgYSBgUmVzcG9uc2VgIG9yIHtAbGlua2NvZGUgSGVhZGVyc30gdXNlZCBpbiBhXG4gKiByZXNwb25zZSB0byB7QGxpbmtjb2RlIENvb2tpZU1hcH0gb3Ige0BsaW5rY29kZSBTZWN1cmVDb29raWVNYXB9LCBtZXJnaW5nXG4gKiB3aWxsIG5vdCBlbnN1cmUgdGhhdCB0aGVyZSBhcmUgbm8gb3RoZXIgYFNldC1Db29raWVgIGhlYWRlcnMgZnJvbSBvdGhlclxuICogc291cmNlcywgaXQgd2lsbCBzaW1wbHkgYXBwZW5kIHRoZSB2YXJpb3VzIGhlYWRlcnMgdG9nZXRoZXIuICovXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VIZWFkZXJzKFxuICAuLi5zb3VyY2VzOiAoSGVhZGVyZWQgfCBIZWFkZXJzSW5pdCB8IE1lcmdlYWJsZSlbXVxuKTogSGVhZGVycyB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBzb3VyY2VzKSB7XG4gICAgbGV0IGVudHJpZXM6IEl0ZXJhYmxlPFtzdHJpbmcsIHN0cmluZ10+O1xuICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBlbnRyaWVzID0gc291cmNlO1xuICAgIH0gZWxzZSBpZiAoXCJoZWFkZXJzXCIgaW4gc291cmNlICYmIHNvdXJjZS5oZWFkZXJzIGluc3RhbmNlb2YgSGVhZGVycykge1xuICAgICAgZW50cmllcyA9IHNvdXJjZS5oZWFkZXJzO1xuICAgIH0gZWxzZSBpZiAoaXNNZXJnZWFibGUoc291cmNlKSkge1xuICAgICAgZW50cmllcyA9IHNvdXJjZVtjb29raWVNYXBIZWFkZXJzSW5pdFN5bWJvbF0oKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoc291cmNlKSkge1xuICAgICAgZW50cmllcyA9IHNvdXJjZSBhcyBbc3RyaW5nLCBzdHJpbmddW107XG4gICAgfSBlbHNlIHtcbiAgICAgIGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzb3VyY2UpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBlbnRyaWVzKSB7XG4gICAgICBoZWFkZXJzLmFwcGVuZChrZXksIHZhbHVlKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGhlYWRlcnM7XG59XG5cbmNvbnN0IGtleXMgPSBTeW1ib2woXCIja2V5c1wiKTtcbmNvbnN0IHJlcXVlc3RIZWFkZXJzID0gU3ltYm9sKFwiI3JlcXVlc3RIZWFkZXJzXCIpO1xuY29uc3QgcmVzcG9uc2VIZWFkZXJzID0gU3ltYm9sKFwiI3Jlc3BvbnNlSGVhZGVyc1wiKTtcbmNvbnN0IGlzU2VjdXJlID0gU3ltYm9sKFwiI3NlY3VyZVwiKTtcbmNvbnN0IHJlcXVlc3RLZXlzID0gU3ltYm9sKFwiI3JlcXVlc3RLZXlzXCIpO1xuXG4vKiogQW4gaW50ZXJuYWwgYWJzdHJhY3QgY2xhc3Mgd2hpY2ggcHJvdmlkZXMgY29tbW9uIGZ1bmN0aW9uYWxpdHkgZm9yXG4gKiB7QGxpbmsgQ29va2llTWFwfSBhbmQge0BsaW5rIFNlY3VyZUNvb2tpZU1hcH0uICovXG5hYnN0cmFjdCBjbGFzcyBDb29raWVNYXBCYXNlIGltcGxlbWVudHMgTWVyZ2VhYmxlIHtcbiAgW2tleXNdPzogc3RyaW5nW107XG4gIFtyZXF1ZXN0SGVhZGVyc106IEhlYWRlcnM7XG4gIFtyZXNwb25zZUhlYWRlcnNdOiBIZWFkZXJzO1xuICBbaXNTZWN1cmVdOiBib29sZWFuO1xuXG4gIFtyZXF1ZXN0S2V5c10oKTogc3RyaW5nW10ge1xuICAgIGlmICh0aGlzW2tleXNdKSB7XG4gICAgICByZXR1cm4gdGhpc1trZXlzXTtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpc1trZXlzXSA9IFtdIGFzIHN0cmluZ1tdO1xuICAgIGNvbnN0IGhlYWRlciA9IHRoaXNbcmVxdWVzdEhlYWRlcnNdLmdldChcImNvb2tpZVwiKTtcbiAgICBpZiAoIWhlYWRlcikge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgbGV0IG1hdGNoZXM6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gICAgd2hpbGUgKChtYXRjaGVzID0gS0VZX1JFR0VYUC5leGVjKGhlYWRlcikpKSB7XG4gICAgICBjb25zdCBbLCBrZXldID0gbWF0Y2hlcztcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihyZXF1ZXN0OiBIZWFkZXJzIHwgSGVhZGVyZWQsIG9wdGlvbnM6IENvb2tpZU1hcE9wdGlvbnMpIHtcbiAgICB0aGlzW3JlcXVlc3RIZWFkZXJzXSA9IFwiaGVhZGVyc1wiIGluIHJlcXVlc3QgPyByZXF1ZXN0LmhlYWRlcnMgOiByZXF1ZXN0O1xuICAgIGNvbnN0IHsgc2VjdXJlID0gZmFsc2UsIHJlc3BvbnNlID0gbmV3IEhlYWRlcnMoKSB9ID0gb3B0aW9ucztcbiAgICB0aGlzW3Jlc3BvbnNlSGVhZGVyc10gPSBcImhlYWRlcnNcIiBpbiByZXNwb25zZSA/IHJlc3BvbnNlLmhlYWRlcnMgOiByZXNwb25zZTtcbiAgICB0aGlzW2lzU2VjdXJlXSA9IHNlY3VyZTtcbiAgfVxuXG4gIC8qKiBBIG1ldGhvZCB1c2VkIGJ5IHtAbGlua2NvZGUgbWVyZ2VIZWFkZXJzfSB0byBiZSBhYmxlIHRvIG1lcmdlXG4gICAqIGhlYWRlcnMgZnJvbSB2YXJpb3VzIHNvdXJjZXMgd2hlbiBmb3JtaW5nIGEge0BsaW5rY29kZSBSZXNwb25zZX0uICovXG4gIFtjb29raWVNYXBIZWFkZXJzSW5pdFN5bWJvbF0oKTogW3N0cmluZywgc3RyaW5nXVtdIHtcbiAgICBjb25zdCBpbml0OiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzW3Jlc3BvbnNlSGVhZGVyc10pIHtcbiAgICAgIGlmIChrZXkgPT09IFwic2V0LWNvb2tpZVwiKSB7XG4gICAgICAgIGluaXQucHVzaChba2V5LCB2YWx1ZV0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5pdDtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXSgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBbXWA7XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIm5vZGVqcy51dGlsLmluc3BlY3QuY3VzdG9tXCIpXShcbiAgICBkZXB0aDogbnVtYmVyLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgb3B0aW9uczogYW55LFxuICAgIGluc3BlY3Q6ICh2YWx1ZTogdW5rbm93biwgb3B0aW9ucz86IHVua25vd24pID0+IHN0cmluZyxcbiAgKSB7XG4gICAgaWYgKGRlcHRoIDwgMCkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuc3R5bGl6ZShgWyR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfV1gLCBcInNwZWNpYWxcIik7XG4gICAgfVxuXG4gICAgY29uc3QgbmV3T3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMsIHtcbiAgICAgIGRlcHRoOiBvcHRpb25zLmRlcHRoID09PSBudWxsID8gbnVsbCA6IG9wdGlvbnMuZGVwdGggLSAxLFxuICAgIH0pO1xuICAgIHJldHVybiBgJHtvcHRpb25zLnN0eWxpemUodGhpcy5jb25zdHJ1Y3Rvci5uYW1lLCBcInNwZWNpYWxcIil9ICR7XG4gICAgICBpbnNwZWN0KFtdLCBuZXdPcHRpb25zKVxuICAgIH1gO1xuICB9XG59XG5cbi8qKlxuICogUHJvdmlkZXMgYSB3YXkgdG8gbWFuYWdlIGNvb2tpZXMgaW4gYSByZXF1ZXN0IGFuZCByZXNwb25zZSBvbiB0aGUgc2VydmVyXG4gKiBhcyBhIHNpbmdsZSBpdGVyYWJsZSBjb2xsZWN0aW9uLlxuICpcbiAqIFRoZSBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzIGFsaWduIHRvIHtAbGlua2NvZGUgTWFwfS4gV2hlbiBjb25zdHJ1Y3RpbmcgYVxuICoge0BsaW5rY29kZSBSZXF1ZXN0fSBvciB7QGxpbmtjb2RlIEhlYWRlcnN9IGZyb20gdGhlIHJlcXVlc3QgbmVlZCB0byBiZVxuICogcHJvdmlkZWQsIGFzIHdlbGwgYXMgb3B0aW9uYWxseSB0aGUge0BsaW5rY29kZSBSZXNwb25zZX0gb3IgYEhlYWRlcnNgIGZvciB0aGVcbiAqIHJlc3BvbnNlIGNhbiBiZSBwcm92aWRlZC4gQWx0ZXJuYXRpdmVseSB0aGUge0BsaW5rY29kZSBtZXJnZUhlYWRlcnN9XG4gKiBmdW5jdGlvbiBjYW4gYmUgdXNlZCB0byBnZW5lcmF0ZSBhIGZpbmFsIHNldCBvZiBoZWFkZXJzIGZvciBzZW5kaW5nIGluIHRoZVxuICogcmVzcG9uc2UuICovXG5leHBvcnQgY2xhc3MgQ29va2llTWFwIGV4dGVuZHMgQ29va2llTWFwQmFzZSB7XG4gIC8qKiBDb250YWlucyB0aGUgbnVtYmVyIG9mIHZhbGlkIGNvb2tpZXMgaW4gdGhlIHJlcXVlc3QgaGVhZGVycy4gKi9cbiAgZ2V0IHNpemUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gWy4uLnRoaXNdLmxlbmd0aDtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHJlcXVlc3Q6IEhlYWRlcnMgfCBIZWFkZXJlZCwgb3B0aW9uczogQ29va2llTWFwT3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIocmVxdWVzdCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKiogRGVsZXRlcyBhbGwgdGhlIGNvb2tpZXMgZnJvbSB0aGUge0BsaW5rY29kZSBSZXF1ZXN0fSBpbiB0aGUgcmVzcG9uc2UuICovXG4gIGNsZWFyKG9wdGlvbnM6IENvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnMgPSB7fSkge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIHRoaXMua2V5cygpKSB7XG4gICAgICB0aGlzLnNldChrZXksIG51bGwsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBTZXQgYSBjb29raWUgdG8gYmUgZGVsZXRlZCBpbiB0aGUgcmVzcG9uc2UuXG4gICAqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgYHNldChrZXksIG51bGwsIG9wdGlvbnM/KWAuXG4gICAqL1xuICBkZWxldGUoa2V5OiBzdHJpbmcsIG9wdGlvbnM6IENvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnMgPSB7fSk6IGJvb2xlYW4ge1xuICAgIHRoaXMuc2V0KGtleSwgbnVsbCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKiogUmV0dXJuIHRoZSB2YWx1ZSBvZiBhIG1hdGNoaW5nIGtleSBwcmVzZW50IGluIHRoZSB7QGxpbmtjb2RlIFJlcXVlc3R9LiBJZlxuICAgKiB0aGUga2V5IGlzIG5vdCBwcmVzZW50IGB1bmRlZmluZWRgIGlzIHJldHVybmVkLiAqL1xuICBnZXQoa2V5OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGhlYWRlclZhbHVlID0gdGhpc1tyZXF1ZXN0SGVhZGVyc10uZ2V0KFwiY29va2llXCIpO1xuICAgIGlmICghaGVhZGVyVmFsdWUpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGNvbnN0IG1hdGNoID0gaGVhZGVyVmFsdWUubWF0Y2goZ2V0UGF0dGVybihrZXkpKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBbLCB2YWx1ZV0gPSBtYXRjaDtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvKiogUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIG1hdGNoaW5nIGtleSBpcyBwcmVzZW50IGluIHRoZSB7QGxpbmtjb2RlIFJlcXVlc3R9LFxuICAgKiBvdGhlcndpc2UgYGZhbHNlYC4gKi9cbiAgaGFzKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3QgaGVhZGVyVmFsdWUgPSB0aGlzW3JlcXVlc3RIZWFkZXJzXS5nZXQoXCJjb29raWVcIik7XG4gICAgaWYgKCFoZWFkZXJWYWx1ZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gZ2V0UGF0dGVybihrZXkpLnRlc3QoaGVhZGVyVmFsdWUpO1xuICB9XG5cbiAgLyoqIFNldCBhIG5hbWVkIGNvb2tpZSBpbiB0aGUgcmVzcG9uc2UuIFRoZSBvcHRpb25hbFxuICAgKiB7QGxpbmtjb2RlIENvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnN9IGFyZSBhcHBsaWVkIHRvIHRoZSBjb29raWUgYmVpbmcgc2V0LlxuICAgKi9cbiAgc2V0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIHZhbHVlOiBzdHJpbmcgfCBudWxsLFxuICAgIG9wdGlvbnM6IENvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnMgPSB7fSxcbiAgKTogdGhpcyB7XG4gICAgY29uc3QgcmVzSGVhZGVycyA9IHRoaXNbcmVzcG9uc2VIZWFkZXJzXTtcbiAgICBjb25zdCB2YWx1ZXM6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgcmVzSGVhZGVycykge1xuICAgICAgaWYgKGtleSA9PT0gXCJzZXQtY29va2llXCIpIHtcbiAgICAgICAgdmFsdWVzLnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBzZWN1cmUgPSB0aGlzW2lzU2VjdXJlXTtcblxuICAgIGlmICghc2VjdXJlICYmIG9wdGlvbnMuc2VjdXJlICYmICFvcHRpb25zLmlnbm9yZUluc2VjdXJlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIkNhbm5vdCBzZW5kIHNlY3VyZSBjb29raWUgb3ZlciB1bmVuY3J5cHRlZCBjb25uZWN0aW9uLlwiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb29raWUgPSBuZXcgQ29va2llKGtleSwgdmFsdWUsIG9wdGlvbnMpO1xuICAgIGNvb2tpZS5zZWN1cmUgPSBvcHRpb25zLnNlY3VyZSA/PyBzZWN1cmU7XG4gICAgcHVzaENvb2tpZSh2YWx1ZXMsIGNvb2tpZSk7XG5cbiAgICByZXNIZWFkZXJzLmRlbGV0ZShcInNldC1jb29raWVcIik7XG4gICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgIHJlc0hlYWRlcnMuYXBwZW5kKFwic2V0LWNvb2tpZVwiLCB2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIEl0ZXJhdGUgb3ZlciB0aGUgY29va2llIGtleXMgYW5kIHZhbHVlcyB0aGF0IGFyZSBwcmVzZW50IGluIHRoZVxuICAgKiB7QGxpbmtjb2RlIFJlcXVlc3R9LiBUaGlzIGlzIGFuIGFsaWFzIG9mIHRoZSBgW1N5bWJvbC5pdGVyYXRvcl1gIG1ldGhvZFxuICAgKiBwcmVzZW50IG9uIHRoZSBjbGFzcy4gKi9cbiAgZW50cmllcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFtzdHJpbmcsIHN0cmluZ10+IHtcbiAgICByZXR1cm4gdGhpc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSBjb29raWUga2V5cyB0aGF0IGFyZSBwcmVzZW50IGluIHRoZVxuICAgKiB7QGxpbmtjb2RlIFJlcXVlc3R9LiAqL1xuICAqa2V5cygpOiBJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgW2tleV0gb2YgdGhpcykge1xuICAgICAgeWllbGQga2V5O1xuICAgIH1cbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIGNvb2tpZSB2YWx1ZXMgdGhhdCBhcmUgcHJlc2VudCBpbiB0aGVcbiAgICoge0BsaW5rY29kZSBSZXF1ZXN0fS4gKi9cbiAgKnZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgWywgdmFsdWVdIG9mIHRoaXMpIHtcbiAgICAgIHlpZWxkIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIGNvb2tpZSBrZXlzIGFuZCB2YWx1ZXMgdGhhdCBhcmUgcHJlc2VudCBpbiB0aGVcbiAgICoge0BsaW5rY29kZSBSZXF1ZXN0fS4gKi9cbiAgKltTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W3N0cmluZywgc3RyaW5nXT4ge1xuICAgIGNvbnN0IGtleXMgPSB0aGlzW3JlcXVlc3RLZXlzXSgpO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB5aWVsZCBba2V5LCB2YWx1ZV07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKiBUeXBlcyBvZiBkYXRhIHRoYXQgY2FuIGJlIHNpZ25lZCBjcnlwdG9ncmFwaGljYWxseS4gKi9cbmV4cG9ydCB0eXBlIERhdGEgPSBzdHJpbmcgfCBudW1iZXJbXSB8IEFycmF5QnVmZmVyIHwgVWludDhBcnJheTtcblxuLyoqIEFuIGludGVyZmFjZSB3aGljaCBkZXNjcmliZXMgdGhlIG1ldGhvZHMgdGhhdCB7QGxpbmtjb2RlIFNlY3VyZUNvb2tpZU1hcH1cbiAqIHVzZXMgdG8gc2lnbiBhbmQgdmVyaWZ5IGNvb2tpZXMuICovXG5leHBvcnQgaW50ZXJmYWNlIEtleVJpbmcge1xuICAvKiogR2l2ZW4gYSBzZXQgb2YgZGF0YSBhbmQgYSBkaWdlc3QsIHJldHVybiB0aGUga2V5IGluZGV4IG9mIHRoZSBrZXkgdXNlZFxuICAgKiB0byBzaWduIHRoZSBkYXRhLiBUaGUgaW5kZXggaXMgMCBiYXNlZC4gQSBub24tbmVnYXRpdmUgbnVtYmVyIGluZGljZXMgdGhlXG4gICAqIGRpZ2VzdCBpcyB2YWxpZCBhbmQgYSBrZXkgd2FzIGZvdW5kLiAqL1xuICBpbmRleE9mKGRhdGE6IERhdGEsIGRpZ2VzdDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHwgbnVtYmVyO1xuICAvKiogU2lnbiB0aGUgZGF0YSwgcmV0dXJuaW5nIGEgc3RyaW5nIGJhc2VkIGRpZ2VzdCBvZiB0aGUgZGF0YS4gKi9cbiAgc2lnbihkYXRhOiBEYXRhKTogUHJvbWlzZTxzdHJpbmc+IHwgc3RyaW5nO1xuICAvKiogVmVyaWZpZXMgdGhlIGRpZ2VzdCBtYXRjaGVzIHRoZSBwcm92aWRlZCBkYXRhLCBpbmRpY2F0aW5nIHRoZSBkYXRhIHdhc1xuICAgKiBzaWduZWQgYnkgdGhlIGtleXJpbmcgYW5kIGhhcyBub3QgYmVlbiB0YW1wZXJlZCB3aXRoLiAqL1xuICB2ZXJpZnkoZGF0YTogRGF0YSwgZGlnZXN0OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHwgYm9vbGVhbjtcbn1cblxuLyoqIFByb3ZpZGVzIGFuIHdheSB0byBtYW5hZ2UgY29va2llcyBpbiBhIHJlcXVlc3QgYW5kIHJlc3BvbnNlIG9uIHRoZSBzZXJ2ZXJcbiAqIGFzIGEgc2luZ2xlIGl0ZXJhYmxlIGNvbGxlY3Rpb24sIGFzIHdlbGwgYXMgdGhlIGFiaWxpdHkgdG8gc2lnbiBhbmQgdmVyaWZ5XG4gKiBjb29raWVzIHRvIHByZXZlbnQgdGFtcGVyaW5nLlxuICpcbiAqIFRoZSBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzIGFsaWduIHRvIHtAbGlua2NvZGUgTWFwfSwgYnV0IGR1ZSB0byB0aGUgbmVlZCB0b1xuICogc3VwcG9ydCBhc3luY2hyb25vdXMgY3J5cHRvZ3JhcGhpYyBrZXlzLCBhbGwgdGhlIEFQSXMgb3BlcmF0ZSBhc3luYy4gV2hlblxuICogY29uc3RydWN0aW5nIGEge0BsaW5rY29kZSBSZXF1ZXN0fSBvciB7QGxpbmtjb2RlIEhlYWRlcnN9IGZyb20gdGhlIHJlcXVlc3RcbiAqIG5lZWQgdG8gYmUgcHJvdmlkZWQsIGFzIHdlbGwgYXMgb3B0aW9uYWxseSB0aGUge0BsaW5rY29kZSBSZXNwb25zZX0gb3JcbiAqIGBIZWFkZXJzYCBmb3IgdGhlIHJlc3BvbnNlIGNhbiBiZSBwcm92aWRlZC4gQWx0ZXJuYXRpdmVseSB0aGVcbiAqIHtAbGlua2NvZGUgbWVyZ2VIZWFkZXJzfSBmdW5jdGlvbiBjYW4gYmUgdXNlZCB0byBnZW5lcmF0ZSBhIGZpbmFsIHNldFxuICogb2YgaGVhZGVycyBmb3Igc2VuZGluZyBpbiB0aGUgcmVzcG9uc2UuXG4gKlxuICogT24gY29uc3RydWN0aW9uLCB0aGUgb3B0aW9uYWwgc2V0IG9mIGtleXMgaW1wbGVtZW50aW5nIHRoZVxuICoge0BsaW5rY29kZSBLZXlSaW5nfSBpbnRlcmZhY2UuIFdoaWxlIGl0IGlzIG9wdGlvbmFsLCBpZiB5b3UgZG9uJ3QgcGxhbiB0byB1c2VcbiAqIGtleXMsIHlvdSBtaWdodCB3YW50IHRvIGNvbnNpZGVyIHVzaW5nIGp1c3QgdGhlIHtAbGlua2NvZGUgQ29va2llTWFwfS5cbiAqXG4gKiBAZXhhbXBsZVxuICovXG5leHBvcnQgY2xhc3MgU2VjdXJlQ29va2llTWFwIGV4dGVuZHMgQ29va2llTWFwQmFzZSB7XG4gICNrZXlSaW5nPzogS2V5UmluZztcblxuICAvKiogSXMgc2V0IHRvIGEgcHJvbWlzZSB3aGljaCByZXNvbHZlcyB3aXRoIHRoZSBudW1iZXIgb2YgY29va2llcyBpbiB0aGVcbiAgICoge0BsaW5rY29kZSBSZXF1ZXN0fS4gKi9cbiAgZ2V0IHNpemUoKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICByZXR1cm4gKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBzaXplID0gMDtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgXyBvZiB0aGlzKSB7XG4gICAgICAgIHNpemUrKztcbiAgICAgIH1cbiAgICAgIHJldHVybiBzaXplO1xuICAgIH0pKCk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICByZXF1ZXN0OiBIZWFkZXJzIHwgSGVhZGVyZWQsXG4gICAgb3B0aW9uczogU2VjdXJlQ29va2llTWFwT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBzdXBlcihyZXF1ZXN0LCBvcHRpb25zKTtcbiAgICBjb25zdCB7IGtleXMgfSA9IG9wdGlvbnM7XG4gICAgdGhpcy4ja2V5UmluZyA9IGtleXM7XG4gIH1cblxuICAvKiogU2V0cyBhbGwgY29va2llcyBpbiB0aGUge0BsaW5rY29kZSBSZXF1ZXN0fSB0byBiZSBkZWxldGVkIGluIHRoZVxuICAgKiByZXNwb25zZS4gKi9cbiAgYXN5bmMgY2xlYXIob3B0aW9uczogU2VjdXJlQ29va2llTWFwU2V0RGVsZXRlT3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qga2V5IG9mIHRoaXMua2V5cygpKSB7XG4gICAgICBhd2FpdCB0aGlzLnNldChrZXksIG51bGwsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBTZXQgYSBjb29raWUgdG8gYmUgZGVsZXRlZCBpbiB0aGUgcmVzcG9uc2UuXG4gICAqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgYHNldChrZXksIG51bGwsIG9wdGlvbnM/KWAuICovXG4gIGFzeW5jIGRlbGV0ZShcbiAgICBrZXk6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTZWN1cmVDb29raWVNYXBTZXREZWxldGVPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGF3YWl0IHRoaXMuc2V0KGtleSwgbnVsbCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKiogR2V0IHRoZSB2YWx1ZSBvZiBhIGNvb2tpZSBmcm9tIHRoZSB7QGxpbmtjb2RlIFJlcXVlc3R9LlxuICAgKlxuICAgKiBJZiB0aGUgY29va2llIGlzIHNpZ25lZCwgYW5kIHRoZSBzaWduYXR1cmUgaXMgaW52YWxpZCwgYHVuZGVmaW5lZGAgd2lsbCBiZVxuICAgKiByZXR1cm5lZCBhbmQgdGhlIGNvb2tpZSB3aWxsIGJlIHNldCB0byBiZSBkZWxldGVkIGluIHRoZSByZXNwb25zZS4gSWYgdGhlXG4gICAqIGNvb2tpZSBpcyB1c2luZyBhbiBcIm9sZFwiIGtleSBmcm9tIHRoZSBrZXlyaW5nLCB0aGUgY29va2llIHdpbGwgYmUgcmUtc2lnbmVkXG4gICAqIHdpdGggdGhlIGN1cnJlbnQga2V5IGFuZCBiZSBhZGRlZCB0byB0aGUgcmVzcG9uc2UgdG8gYmUgdXBkYXRlZC4gKi9cbiAgYXN5bmMgZ2V0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFNlY3VyZUNvb2tpZU1hcEdldE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zdCBzaWduZWQgPSBvcHRpb25zLnNpZ25lZCA/PyAhIXRoaXMuI2tleVJpbmc7XG4gICAgY29uc3QgbmFtZVNpZyA9IGAke2tleX0uc2lnYDtcblxuICAgIGNvbnN0IGhlYWRlciA9IHRoaXNbcmVxdWVzdEhlYWRlcnNdLmdldChcImNvb2tpZVwiKTtcbiAgICBpZiAoIWhlYWRlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBtYXRjaCA9IGhlYWRlci5tYXRjaChnZXRQYXR0ZXJuKGtleSkpO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgWywgdmFsdWVdID0gbWF0Y2g7XG4gICAgaWYgKCFzaWduZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgY29uc3QgZGlnZXN0ID0gYXdhaXQgdGhpcy5nZXQobmFtZVNpZywgeyBzaWduZWQ6IGZhbHNlIH0pO1xuICAgIGlmICghZGlnZXN0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBgJHtrZXl9PSR7dmFsdWV9YDtcbiAgICBpZiAoIXRoaXMuI2tleVJpbmcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJrZXkgcmluZyByZXF1aXJlZCBmb3Igc2lnbmVkIGNvb2tpZXNcIik7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gYXdhaXQgdGhpcy4ja2V5UmluZy5pbmRleE9mKGRhdGEsIGRpZ2VzdCk7XG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICBhd2FpdCB0aGlzLmRlbGV0ZShuYW1lU2lnLCB7IHBhdGg6IFwiL1wiLCBzaWduZWQ6IGZhbHNlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW5kZXgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5zZXQobmFtZVNpZywgYXdhaXQgdGhpcy4ja2V5UmluZy5zaWduKGRhdGEpLCB7XG4gICAgICAgICAgc2lnbmVkOiBmYWxzZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHVybnMgYHRydWVgIGlmIHRoZSBrZXkgaXMgaW4gdGhlIHtAbGlua2NvZGUgUmVxdWVzdH0uXG4gICAqXG4gICAqIElmIHRoZSBjb29raWUgaXMgc2lnbmVkLCBhbmQgdGhlIHNpZ25hdHVyZSBpcyBpbnZhbGlkLCBgZmFsc2VgIHdpbGwgYmVcbiAgICogcmV0dXJuZWQgYW5kIHRoZSBjb29raWUgd2lsbCBiZSBzZXQgdG8gYmUgZGVsZXRlZCBpbiB0aGUgcmVzcG9uc2UuIElmIHRoZVxuICAgKiBjb29raWUgaXMgdXNpbmcgYW4gXCJvbGRcIiBrZXkgZnJvbSB0aGUga2V5cmluZywgdGhlIGNvb2tpZSB3aWxsIGJlIHJlLXNpZ25lZFxuICAgKiB3aXRoIHRoZSBjdXJyZW50IGtleSBhbmQgYmUgYWRkZWQgdG8gdGhlIHJlc3BvbnNlIHRvIGJlIHVwZGF0ZWQuICovXG4gIGFzeW5jIGhhcyhcbiAgICBrZXk6IHN0cmluZyxcbiAgICBvcHRpb25zOiBTZWN1cmVDb29raWVNYXBHZXRPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGNvbnN0IHNpZ25lZCA9IG9wdGlvbnMuc2lnbmVkID8/ICEhdGhpcy4ja2V5UmluZztcbiAgICBjb25zdCBuYW1lU2lnID0gYCR7a2V5fS5zaWdgO1xuXG4gICAgY29uc3QgaGVhZGVyID0gdGhpc1tyZXF1ZXN0SGVhZGVyc10uZ2V0KFwiY29va2llXCIpO1xuICAgIGlmICghaGVhZGVyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IG1hdGNoID0gaGVhZGVyLm1hdGNoKGdldFBhdHRlcm4oa2V5KSk7XG4gICAgaWYgKCFtYXRjaCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoIXNpZ25lZCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGRpZ2VzdCA9IGF3YWl0IHRoaXMuZ2V0KG5hbWVTaWcsIHsgc2lnbmVkOiBmYWxzZSB9KTtcbiAgICBpZiAoIWRpZ2VzdCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBbLCB2YWx1ZV0gPSBtYXRjaDtcbiAgICBjb25zdCBkYXRhID0gYCR7a2V5fT0ke3ZhbHVlfWA7XG4gICAgaWYgKCF0aGlzLiNrZXlSaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5IHJpbmcgcmVxdWlyZWQgZm9yIHNpZ25lZCBjb29raWVzXCIpO1xuICAgIH1cbiAgICBjb25zdCBpbmRleCA9IGF3YWl0IHRoaXMuI2tleVJpbmcuaW5kZXhPZihkYXRhLCBkaWdlc3QpO1xuXG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgYXdhaXQgdGhpcy5kZWxldGUobmFtZVNpZywgeyBwYXRoOiBcIi9cIiwgc2lnbmVkOiBmYWxzZSB9KTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGluZGV4KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2V0KG5hbWVTaWcsIGF3YWl0IHRoaXMuI2tleVJpbmcuc2lnbihkYXRhKSwge1xuICAgICAgICAgIHNpZ25lZDogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgLyoqIFNldCBhIGNvb2tpZSBpbiB0aGUgcmVzcG9uc2UgaGVhZGVycy5cbiAgICpcbiAgICogSWYgdGhlcmUgd2FzIGEga2V5cmluZyBzZXQsIGNvb2tpZXMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHNpZ25lZCwgdW5sZXNzXG4gICAqIG92ZXJyaWRkZW4gYnkgdGhlIHBhc3NlZCBvcHRpb25zLiBDb29raWVzIGNhbiBiZSBkZWxldGVkIGJ5IHNldHRpbmcgdGhlXG4gICAqIHZhbHVlIHRvIGBudWxsYC4gKi9cbiAgYXN5bmMgc2V0KFxuICAgIGtleTogc3RyaW5nLFxuICAgIHZhbHVlOiBzdHJpbmcgfCBudWxsLFxuICAgIG9wdGlvbnM6IFNlY3VyZUNvb2tpZU1hcFNldERlbGV0ZU9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTx0aGlzPiB7XG4gICAgY29uc3QgcmVzSGVhZGVycyA9IHRoaXNbcmVzcG9uc2VIZWFkZXJzXTtcbiAgICBjb25zdCBoZWFkZXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHJlc0hlYWRlcnMuZW50cmllcygpKSB7XG4gICAgICBpZiAoa2V5ID09PSBcInNldC1jb29raWVcIikge1xuICAgICAgICBoZWFkZXJzLnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBzZWN1cmUgPSB0aGlzW2lzU2VjdXJlXTtcbiAgICBjb25zdCBzaWduZWQgPSBvcHRpb25zLnNpZ25lZCA/PyAhIXRoaXMuI2tleVJpbmc7XG5cbiAgICBpZiAoIXNlY3VyZSAmJiBvcHRpb25zLnNlY3VyZSAmJiAhb3B0aW9ucy5pZ25vcmVJbnNlY3VyZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgXCJDYW5ub3Qgc2VuZCBzZWN1cmUgY29va2llIG92ZXIgdW5lbmNyeXB0ZWQgY29ubmVjdGlvbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgY29va2llID0gbmV3IENvb2tpZShrZXksIHZhbHVlLCBvcHRpb25zKTtcbiAgICBjb29raWUuc2VjdXJlID0gb3B0aW9ucy5zZWN1cmUgPz8gc2VjdXJlO1xuICAgIHB1c2hDb29raWUoaGVhZGVycywgY29va2llKTtcblxuICAgIGlmIChzaWduZWQpIHtcbiAgICAgIGlmICghdGhpcy4ja2V5UmluZykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5cyByZXF1aXJlZCBmb3Igc2lnbmVkIGNvb2tpZXMuXCIpO1xuICAgICAgfVxuICAgICAgY29va2llLnZhbHVlID0gYXdhaXQgdGhpcy4ja2V5UmluZy5zaWduKGNvb2tpZS50b1N0cmluZygpKTtcbiAgICAgIGNvb2tpZS5uYW1lICs9IFwiLnNpZ1wiO1xuICAgICAgcHVzaENvb2tpZShoZWFkZXJzLCBjb29raWUpO1xuICAgIH1cblxuICAgIHJlc0hlYWRlcnMuZGVsZXRlKFwic2V0LWNvb2tpZVwiKTtcbiAgICBmb3IgKGNvbnN0IGhlYWRlciBvZiBoZWFkZXJzKSB7XG4gICAgICByZXNIZWFkZXJzLmFwcGVuZChcInNldC1jb29raWVcIiwgaGVhZGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSB7QGxpbmtjb2RlIFJlcXVlc3R9IGNvb2tpZXMsIHlpZWxkaW5nIHVwIGEgdHVwbGVcbiAgICogY29udGFpbmluZyB0aGUga2V5IGFuZCB2YWx1ZSBvZiBlYWNoIGNvb2tpZS5cbiAgICpcbiAgICogSWYgYSBrZXkgcmluZyB3YXMgcHJvdmlkZWQsIG9ubHkgcHJvcGVybHkgc2lnbmVkIGNvb2tpZSBrZXlzIGFuZCB2YWx1ZXMgYXJlXG4gICAqIHJldHVybmVkLiAqL1xuICBlbnRyaWVzKCk6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBzdHJpbmddPiB7XG4gICAgcmV0dXJuIHRoaXNbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSByZXF1ZXN0J3MgY29va2llcywgeWllbGRpbmcgdXAgdGhlIGtleSBvZiBlYWNoIGNvb2tpZS5cbiAgICpcbiAgICogSWYgYSBrZXlyaW5nIHdhcyBwcm92aWRlZCwgb25seSBwcm9wZXJseSBzaWduZWQgY29va2llIGtleXMgYXJlXG4gICAqIHJldHVybmVkLiAqL1xuICBhc3luYyAqa2V5cygpOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPiB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBba2V5XSBvZiB0aGlzKSB7XG4gICAgICB5aWVsZCBrZXk7XG4gICAgfVxuICB9XG5cbiAgLyoqIEl0ZXJhdGUgb3ZlciB0aGUgcmVxdWVzdCdzIGNvb2tpZXMsIHlpZWxkaW5nIHVwIHRoZSB2YWx1ZSBvZiBlYWNoIGNvb2tpZS5cbiAgICpcbiAgICogSWYgYSBrZXlyaW5nIHdhcyBwcm92aWRlZCwgb25seSBwcm9wZXJseSBzaWduZWQgY29va2llIHZhbHVlcyBhcmVcbiAgICogcmV0dXJuZWQuICovXG4gIGFzeW5jICp2YWx1ZXMoKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciBhd2FpdCAoY29uc3QgWywgdmFsdWVdIG9mIHRoaXMpIHtcbiAgICAgIHlpZWxkIHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHtAbGlua2NvZGUgUmVxdWVzdH0gY29va2llcywgeWllbGRpbmcgdXAgYSB0dXBsZVxuICAgKiBjb250YWluaW5nIHRoZSBrZXkgYW5kIHZhbHVlIG9mIGVhY2ggY29va2llLlxuICAgKlxuICAgKiBJZiBhIGtleSByaW5nIHdhcyBwcm92aWRlZCwgb25seSBwcm9wZXJseSBzaWduZWQgY29va2llIGtleXMgYW5kIHZhbHVlcyBhcmVcbiAgICogcmV0dXJuZWQuICovXG4gIGFzeW5jICpbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBzdHJpbmddPiB7XG4gICAgY29uc3Qga2V5cyA9IHRoaXNbcmVxdWVzdEtleXNdKCk7XG4gICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLmdldChrZXkpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHlpZWxkIFtrZXksIHZhbHVlXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQWdGQyxHQTJHRCxvQ0FBb0M7QUFDcEMsTUFBTSx1QkFBdUI7QUFDN0IsTUFBTSxhQUFhO0FBQ25CLE1BQU0sbUJBQW1CO0FBRXpCLE1BQU0sYUFBcUMsQ0FBQztBQUM1QyxTQUFTLFdBQVcsSUFBWTtFQUM5QixJQUFJLFFBQVEsWUFBWTtJQUN0QixPQUFPLFVBQVUsQ0FBQyxLQUFLO0VBQ3pCO0VBRUEsT0FBTyxVQUFVLENBQUMsS0FBSyxHQUFHLElBQUksT0FDNUIsQ0FBQyxTQUFTLEVBQUUsS0FBSyxPQUFPLENBQUMsNEJBQTRCLFFBQVEsUUFBUSxDQUFDO0FBRTFFO0FBRUEsU0FBUyxXQUFXLE1BQWdCLEVBQUUsTUFBYztFQUNsRCxJQUFJLE9BQU8sU0FBUyxFQUFFO0lBQ3BCLElBQUssSUFBSSxJQUFJLE9BQU8sTUFBTSxHQUFHLEdBQUcsS0FBSyxHQUFHLElBQUs7TUFDM0MsSUFBSSxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRztRQUM5QyxPQUFPLE1BQU0sQ0FBQyxHQUFHO01BQ25CO0lBQ0Y7RUFDRjtFQUNBLE9BQU8sSUFBSSxDQUFDLE9BQU8sYUFBYTtBQUNsQztBQUVBLFNBQVMsdUJBQ1AsR0FBVyxFQUNYLEtBQWdDO0VBRWhDLElBQUksU0FBUyxDQUFDLHFCQUFxQixJQUFJLENBQUMsUUFBUTtJQUM5QyxNQUFNLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxJQUFJLGlCQUFpQixFQUFFLE1BQU0sYUFBYSxDQUFDO0VBQ3pFO0FBQ0Y7QUFFQSwrQ0FBK0MsR0FDL0MsTUFBTTtFQUNKLE9BQWdCO0VBQ2hCLFFBQWU7RUFDZixXQUFXLEtBQUs7RUFDaEIsT0FBZ0I7RUFDaEIsS0FBYTtFQUNiLFlBQVksTUFBTTtFQUNsQixPQUFPLElBQUk7RUFDWCxXQUFnRCxNQUFNO0VBQ3RELFNBQVMsTUFBTTtFQUNmLE9BQWlCO0VBQ2pCLE1BQWM7RUFFZCxZQUNFLElBQVksRUFDWixLQUFvQixFQUNwQixVQUE0QixDQUM1QjtJQUNBLHVCQUF1QixRQUFRO0lBQy9CLElBQUksQ0FBQyxJQUFJLEdBQUc7SUFDWix1QkFBdUIsU0FBUztJQUNoQyxJQUFJLENBQUMsS0FBSyxHQUFHLFNBQVM7SUFDdEIsT0FBTyxNQUFNLENBQUMsSUFBSSxFQUFFO0lBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO01BQ2YsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEtBQUs7TUFDeEIsSUFBSSxDQUFDLE1BQU0sR0FBRztJQUNoQjtJQUVBLHVCQUF1QixRQUFRLElBQUksQ0FBQyxJQUFJO0lBQ3hDLHVCQUF1QixVQUFVLElBQUksQ0FBQyxNQUFNO0lBQzVDLElBQ0UsSUFBSSxDQUFDLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxRQUFRLEtBQUssWUFDMUMsQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQ3BDO01BQ0EsTUFBTSxJQUFJLFVBQ1IsQ0FBQywrQkFBK0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQztJQUVuRTtFQUNGO0VBRUEsZ0JBQXdCO0lBQ3RCLElBQUksUUFBUSxJQUFJLENBQUMsUUFBUTtJQUN6QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7TUFDZixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksS0FBSyxLQUFLLEdBQUcsS0FBTSxJQUFJLENBQUMsTUFBTSxHQUFHO0lBQ3REO0lBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO01BQ2IsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEM7SUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7TUFDaEIsU0FBUyxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsR0FBRyxDQUFDO0lBQ3BEO0lBQ0EsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO01BQ2YsU0FBUyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEM7SUFDQSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7TUFDakIsU0FBUyxDQUFDLFdBQVcsRUFDbkIsSUFBSSxDQUFDLFFBQVEsS0FBSyxPQUFPLFdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQzlELENBQUM7SUFDSjtJQUNBLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtNQUNmLFNBQVM7SUFDWDtJQUNBLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtNQUNqQixTQUFTO0lBQ1g7SUFDQSxPQUFPO0VBQ1Q7RUFFQSxXQUFtQjtJQUNqQixPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDckM7QUFDRjtBQUVBOztZQUVZLEdBQ1osT0FBTyxNQUFNLDZCQUE2QixPQUFPLEdBQUcsQ0FDbEQsa0NBQ0E7QUFFRixTQUFTLFlBQVksS0FBYztFQUNqQyxPQUFPLFNBQVMsUUFBUSxPQUFPLFVBQVUsWUFDdkMsOEJBQThCO0FBQ2xDO0FBRUE7Ozs7OztnRUFNZ0UsR0FDaEUsT0FBTyxTQUFTLGFBQ2QsR0FBRyxPQUErQztFQUVsRCxNQUFNLFVBQVUsSUFBSTtFQUNwQixLQUFLLE1BQU0sVUFBVSxRQUFTO0lBQzVCLElBQUk7SUFDSixJQUFJLGtCQUFrQixTQUFTO01BQzdCLFVBQVU7SUFDWixPQUFPLElBQUksYUFBYSxVQUFVLE9BQU8sT0FBTyxZQUFZLFNBQVM7TUFDbkUsVUFBVSxPQUFPLE9BQU87SUFDMUIsT0FBTyxJQUFJLFlBQVksU0FBUztNQUM5QixVQUFVLE1BQU0sQ0FBQywyQkFBMkI7SUFDOUMsT0FBTyxJQUFJLE1BQU0sT0FBTyxDQUFDLFNBQVM7TUFDaEMsVUFBVTtJQUNaLE9BQU87TUFDTCxVQUFVLE9BQU8sT0FBTyxDQUFDO0lBQzNCO0lBQ0EsS0FBSyxNQUFNLENBQUMsS0FBSyxNQUFNLElBQUksUUFBUztNQUNsQyxRQUFRLE1BQU0sQ0FBQyxLQUFLO0lBQ3RCO0VBQ0Y7RUFDQSxPQUFPO0FBQ1Q7QUFFQSxNQUFNLE9BQU8sT0FBTztBQUNwQixNQUFNLGlCQUFpQixPQUFPO0FBQzlCLE1BQU0sa0JBQWtCLE9BQU87QUFDL0IsTUFBTSxXQUFXLE9BQU87QUFDeEIsTUFBTSxjQUFjLE9BQU87QUFFM0I7a0RBQ2tELEdBQ2xELE1BQWU7RUFDYixDQUFDLEtBQUssQ0FBWTtFQUNsQixDQUFDLGVBQWUsQ0FBVTtFQUMxQixDQUFDLGdCQUFnQixDQUFVO0VBQzNCLENBQUMsU0FBUyxDQUFVO0VBRXBCLENBQUMsWUFBWSxHQUFhO0lBQ3hCLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtNQUNkLE9BQU8sSUFBSSxDQUFDLEtBQUs7SUFDbkI7SUFDQSxNQUFNLFNBQVMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO0lBQzlCLE1BQU0sU0FBUyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQztJQUN4QyxJQUFJLENBQUMsUUFBUTtNQUNYLE9BQU87SUFDVDtJQUNBLElBQUk7SUFDSixNQUFRLFVBQVUsV0FBVyxJQUFJLENBQUMsUUFBVTtNQUMxQyxNQUFNLEdBQUcsSUFBSSxHQUFHO01BQ2hCLE9BQU8sSUFBSSxDQUFDO0lBQ2Q7SUFDQSxPQUFPO0VBQ1Q7RUFFQSxZQUFZLE9BQTJCLEVBQUUsT0FBeUIsQ0FBRTtJQUNsRSxJQUFJLENBQUMsZUFBZSxHQUFHLGFBQWEsVUFBVSxRQUFRLE9BQU8sR0FBRztJQUNoRSxNQUFNLEVBQUUsU0FBUyxLQUFLLEVBQUUsV0FBVyxJQUFJLFNBQVMsRUFBRSxHQUFHO0lBQ3JELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxhQUFhLFdBQVcsU0FBUyxPQUFPLEdBQUc7SUFDbkUsSUFBSSxDQUFDLFNBQVMsR0FBRztFQUNuQjtFQUVBO3VFQUNxRSxHQUNyRSxDQUFDLDJCQUEyQixHQUF1QjtJQUNqRCxNQUFNLE9BQTJCLEVBQUU7SUFDbkMsS0FBSyxNQUFNLENBQUMsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFFO01BQ2hELElBQUksUUFBUSxjQUFjO1FBQ3hCLEtBQUssSUFBSSxDQUFDO1VBQUM7VUFBSztTQUFNO01BQ3hCO0lBQ0Y7SUFDQSxPQUFPO0VBQ1Q7RUFFQSxDQUFDLE9BQU8sR0FBRyxDQUFDLHNCQUFzQixHQUFHO0lBQ25DLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztFQUN0QztFQUVBLENBQUMsT0FBTyxHQUFHLENBQUMsOEJBQThCLENBQ3hDLEtBQWEsRUFDYixtQ0FBbUM7RUFDbkMsT0FBWSxFQUNaLE9BQXNELEVBQ3REO0lBQ0EsSUFBSSxRQUFRLEdBQUc7TUFDYixPQUFPLFFBQVEsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ3ZEO0lBRUEsTUFBTSxhQUFhLE9BQU8sTUFBTSxDQUFDLENBQUMsR0FBRyxTQUFTO01BQzVDLE9BQU8sUUFBUSxLQUFLLEtBQUssT0FBTyxPQUFPLFFBQVEsS0FBSyxHQUFHO0lBQ3pEO0lBQ0EsT0FBTyxDQUFDLEVBQUUsUUFBUSxPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLEVBQzNELFFBQVEsRUFBRSxFQUFFLFlBQ2IsQ0FBQztFQUNKO0FBQ0Y7QUFFQTs7Ozs7Ozs7O2FBU2EsR0FDYixPQUFPLE1BQU0sa0JBQWtCO0VBQzdCLGlFQUFpRSxHQUNqRSxJQUFJLE9BQWU7SUFDakIsT0FBTztTQUFJLElBQUk7S0FBQyxDQUFDLE1BQU07RUFDekI7RUFFQSxZQUFZLE9BQTJCLEVBQUUsVUFBNEIsQ0FBQyxDQUFDLENBQUU7SUFDdkUsS0FBSyxDQUFDLFNBQVM7RUFDakI7RUFFQSwwRUFBMEUsR0FDMUUsTUFBTSxVQUFxQyxDQUFDLENBQUMsRUFBRTtJQUM3QyxLQUFLLE1BQU0sT0FBTyxJQUFJLENBQUMsSUFBSSxHQUFJO01BQzdCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxNQUFNO0lBQ3RCO0VBQ0Y7RUFFQTs7O0dBR0MsR0FDRCxPQUFPLEdBQVcsRUFBRSxVQUFxQyxDQUFDLENBQUMsRUFBVztJQUNwRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssTUFBTTtJQUNwQixPQUFPO0VBQ1Q7RUFFQTtxREFDbUQsR0FDbkQsSUFBSSxHQUFXLEVBQXNCO0lBQ25DLE1BQU0sY0FBYyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQztJQUM3QyxJQUFJLENBQUMsYUFBYTtNQUNoQixPQUFPO0lBQ1Q7SUFDQSxNQUFNLFFBQVEsWUFBWSxLQUFLLENBQUMsV0FBVztJQUMzQyxJQUFJLENBQUMsT0FBTztNQUNWLE9BQU87SUFDVDtJQUNBLE1BQU0sR0FBRyxNQUFNLEdBQUc7SUFDbEIsT0FBTztFQUNUO0VBRUE7d0JBQ3NCLEdBQ3RCLElBQUksR0FBVyxFQUFXO0lBQ3hCLE1BQU0sY0FBYyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQztJQUM3QyxJQUFJLENBQUMsYUFBYTtNQUNoQixPQUFPO0lBQ1Q7SUFDQSxPQUFPLFdBQVcsS0FBSyxJQUFJLENBQUM7RUFDOUI7RUFFQTs7R0FFQyxHQUNELElBQ0UsR0FBVyxFQUNYLEtBQW9CLEVBQ3BCLFVBQXFDLENBQUMsQ0FBQyxFQUNqQztJQUNOLE1BQU0sYUFBYSxJQUFJLENBQUMsZ0JBQWdCO0lBQ3hDLE1BQU0sU0FBbUIsRUFBRTtJQUMzQixLQUFLLE1BQU0sQ0FBQyxLQUFLLE1BQU0sSUFBSSxXQUFZO01BQ3JDLElBQUksUUFBUSxjQUFjO1FBQ3hCLE9BQU8sSUFBSSxDQUFDO01BQ2Q7SUFDRjtJQUNBLE1BQU0sU0FBUyxJQUFJLENBQUMsU0FBUztJQUU3QixJQUFJLENBQUMsVUFBVSxRQUFRLE1BQU0sSUFBSSxDQUFDLFFBQVEsY0FBYyxFQUFFO01BQ3hELE1BQU0sSUFBSSxVQUNSO0lBRUo7SUFFQSxNQUFNLFNBQVMsSUFBSSxPQUFPLEtBQUssT0FBTztJQUN0QyxPQUFPLE1BQU0sR0FBRyxRQUFRLE1BQU0sSUFBSTtJQUNsQyxXQUFXLFFBQVE7SUFFbkIsV0FBVyxNQUFNLENBQUM7SUFDbEIsS0FBSyxNQUFNLFNBQVMsT0FBUTtNQUMxQixXQUFXLE1BQU0sQ0FBQyxjQUFjO0lBQ2xDO0lBQ0EsT0FBTyxJQUFJO0VBQ2I7RUFFQTs7MkJBRXlCLEdBQ3pCLFVBQThDO0lBQzVDLE9BQU8sSUFBSSxDQUFDLE9BQU8sUUFBUSxDQUFDO0VBQzlCO0VBRUE7MEJBQ3dCLEdBQ3hCLENBQUMsT0FBaUM7SUFDaEMsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBRTtNQUN4QixNQUFNO0lBQ1I7RUFDRjtFQUVBOzBCQUN3QixHQUN4QixDQUFDLFNBQW1DO0lBQ2xDLEtBQUssTUFBTSxHQUFHLE1BQU0sSUFBSSxJQUFJLENBQUU7TUFDNUIsTUFBTTtJQUNSO0VBQ0Y7RUFFQTswQkFDd0IsR0FDeEIsQ0FBQyxDQUFDLE9BQU8sUUFBUSxDQUFDLEdBQXVDO0lBQ3ZELE1BQU0sT0FBTyxJQUFJLENBQUMsWUFBWTtJQUM5QixLQUFLLE1BQU0sT0FBTyxLQUFNO01BQ3RCLE1BQU0sUUFBUSxJQUFJLENBQUMsR0FBRyxDQUFDO01BQ3ZCLElBQUksT0FBTztRQUNULE1BQU07VUFBQztVQUFLO1NBQU07TUFDcEI7SUFDRjtFQUNGO0FBQ0Y7QUFtQkE7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBaUJDLEdBQ0QsT0FBTyxNQUFNLHdCQUF3QjtFQUNuQyxDQUFDLE9BQU8sQ0FBVztFQUVuQjswQkFDd0IsR0FDeEIsSUFBSSxPQUF3QjtJQUMxQixPQUFPLEFBQUMsQ0FBQTtNQUNOLElBQUksT0FBTztNQUNYLFdBQVcsTUFBTSxLQUFLLElBQUksQ0FBRTtRQUMxQjtNQUNGO01BQ0EsT0FBTztJQUNULENBQUE7RUFDRjtFQUVBLFlBQ0UsT0FBMkIsRUFDM0IsVUFBa0MsQ0FBQyxDQUFDLENBQ3BDO0lBQ0EsS0FBSyxDQUFDLFNBQVM7SUFDZixNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUc7SUFDakIsSUFBSSxDQUFDLENBQUMsT0FBTyxHQUFHO0VBQ2xCO0VBRUE7ZUFDYSxHQUNiLE1BQU0sTUFBTSxPQUF3QyxFQUFFO0lBQ3BELFdBQVcsTUFBTSxPQUFPLElBQUksQ0FBQyxJQUFJLEdBQUk7TUFDbkMsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssTUFBTTtJQUM1QjtFQUNGO0VBRUE7O29FQUVrRSxHQUNsRSxNQUFNLE9BQ0osR0FBVyxFQUNYLFVBQTJDLENBQUMsQ0FBQyxFQUMzQjtJQUNsQixNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxNQUFNO0lBQzFCLE9BQU87RUFDVDtFQUVBOzs7OztzRUFLb0UsR0FDcEUsTUFBTSxJQUNKLEdBQVcsRUFDWCxVQUFxQyxDQUFDLENBQUMsRUFDVjtJQUM3QixNQUFNLFNBQVMsUUFBUSxNQUFNLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU87SUFDaEQsTUFBTSxVQUFVLENBQUMsRUFBRSxJQUFJLElBQUksQ0FBQztJQUU1QixNQUFNLFNBQVMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUM7SUFDeEMsSUFBSSxDQUFDLFFBQVE7TUFDWDtJQUNGO0lBQ0EsTUFBTSxRQUFRLE9BQU8sS0FBSyxDQUFDLFdBQVc7SUFDdEMsSUFBSSxDQUFDLE9BQU87TUFDVjtJQUNGO0lBQ0EsTUFBTSxHQUFHLE1BQU0sR0FBRztJQUNsQixJQUFJLENBQUMsUUFBUTtNQUNYLE9BQU87SUFDVDtJQUNBLE1BQU0sU0FBUyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUztNQUFFLFFBQVE7SUFBTTtJQUN2RCxJQUFJLENBQUMsUUFBUTtNQUNYO0lBQ0Y7SUFDQSxNQUFNLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFO01BQ2xCLE1BQU0sSUFBSSxVQUFVO0lBQ3RCO0lBQ0EsTUFBTSxRQUFRLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNO0lBRWhELElBQUksUUFBUSxHQUFHO01BQ2IsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVM7UUFBRSxNQUFNO1FBQUssUUFBUTtNQUFNO0lBQ3hELE9BQU87TUFDTCxJQUFJLE9BQU87UUFDVCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxNQUFNLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTztVQUN0RCxRQUFRO1FBQ1Y7TUFDRjtNQUNBLE9BQU87SUFDVDtFQUNGO0VBRUE7Ozs7O3NFQUtvRSxHQUNwRSxNQUFNLElBQ0osR0FBVyxFQUNYLFVBQXFDLENBQUMsQ0FBQyxFQUNyQjtJQUNsQixNQUFNLFNBQVMsUUFBUSxNQUFNLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU87SUFDaEQsTUFBTSxVQUFVLENBQUMsRUFBRSxJQUFJLElBQUksQ0FBQztJQUU1QixNQUFNLFNBQVMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUM7SUFDeEMsSUFBSSxDQUFDLFFBQVE7TUFDWCxPQUFPO0lBQ1Q7SUFDQSxNQUFNLFFBQVEsT0FBTyxLQUFLLENBQUMsV0FBVztJQUN0QyxJQUFJLENBQUMsT0FBTztNQUNWLE9BQU87SUFDVDtJQUNBLElBQUksQ0FBQyxRQUFRO01BQ1gsT0FBTztJQUNUO0lBQ0EsTUFBTSxTQUFTLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTO01BQUUsUUFBUTtJQUFNO0lBQ3ZELElBQUksQ0FBQyxRQUFRO01BQ1gsT0FBTztJQUNUO0lBQ0EsTUFBTSxHQUFHLE1BQU0sR0FBRztJQUNsQixNQUFNLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQztJQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFO01BQ2xCLE1BQU0sSUFBSSxVQUFVO0lBQ3RCO0lBQ0EsTUFBTSxRQUFRLE1BQU0sSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNO0lBRWhELElBQUksUUFBUSxHQUFHO01BQ2IsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVM7UUFBRSxNQUFNO1FBQUssUUFBUTtNQUFNO01BQ3RELE9BQU87SUFDVCxPQUFPO01BQ0wsSUFBSSxPQUFPO1FBQ1QsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsTUFBTSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU87VUFDdEQsUUFBUTtRQUNWO01BQ0Y7TUFDQSxPQUFPO0lBQ1Q7RUFDRjtFQUVBOzs7O3NCQUlvQixHQUNwQixNQUFNLElBQ0osR0FBVyxFQUNYLEtBQW9CLEVBQ3BCLFVBQTJDLENBQUMsQ0FBQyxFQUM5QjtJQUNmLE1BQU0sYUFBYSxJQUFJLENBQUMsZ0JBQWdCO0lBQ3hDLE1BQU0sVUFBb0IsRUFBRTtJQUM1QixLQUFLLE1BQU0sQ0FBQyxLQUFLLE1BQU0sSUFBSSxXQUFXLE9BQU8sR0FBSTtNQUMvQyxJQUFJLFFBQVEsY0FBYztRQUN4QixRQUFRLElBQUksQ0FBQztNQUNmO0lBQ0Y7SUFDQSxNQUFNLFNBQVMsSUFBSSxDQUFDLFNBQVM7SUFDN0IsTUFBTSxTQUFTLFFBQVEsTUFBTSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPO0lBRWhELElBQUksQ0FBQyxVQUFVLFFBQVEsTUFBTSxJQUFJLENBQUMsUUFBUSxjQUFjLEVBQUU7TUFDeEQsTUFBTSxJQUFJLFVBQ1I7SUFFSjtJQUVBLE1BQU0sU0FBUyxJQUFJLE9BQU8sS0FBSyxPQUFPO0lBQ3RDLE9BQU8sTUFBTSxHQUFHLFFBQVEsTUFBTSxJQUFJO0lBQ2xDLFdBQVcsU0FBUztJQUVwQixJQUFJLFFBQVE7TUFDVixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFO1FBQ2xCLE1BQU0sSUFBSSxVQUFVO01BQ3RCO01BQ0EsT0FBTyxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sUUFBUTtNQUN2RCxPQUFPLElBQUksSUFBSTtNQUNmLFdBQVcsU0FBUztJQUN0QjtJQUVBLFdBQVcsTUFBTSxDQUFDO0lBQ2xCLEtBQUssTUFBTSxVQUFVLFFBQVM7TUFDNUIsV0FBVyxNQUFNLENBQUMsY0FBYztJQUNsQztJQUNBLE9BQU8sSUFBSTtFQUNiO0VBRUE7Ozs7ZUFJYSxHQUNiLFVBQW1EO0lBQ2pELE9BQU8sSUFBSSxDQUFDLE9BQU8sYUFBYSxDQUFDO0VBQ25DO0VBRUE7OztlQUdhLEdBQ2IsT0FBTyxPQUFzQztJQUMzQyxXQUFXLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFFO01BQzlCLE1BQU07SUFDUjtFQUNGO0VBRUE7OztlQUdhLEdBQ2IsT0FBTyxTQUF3QztJQUM3QyxXQUFXLE1BQU0sR0FBRyxNQUFNLElBQUksSUFBSSxDQUFFO01BQ2xDLE1BQU07SUFDUjtFQUNGO0VBRUE7Ozs7ZUFJYSxHQUNiLE9BQU8sQ0FBQyxPQUFPLGFBQWEsQ0FBQyxHQUE0QztJQUN2RSxNQUFNLE9BQU8sSUFBSSxDQUFDLFlBQVk7SUFDOUIsS0FBSyxNQUFNLE9BQU8sS0FBTTtNQUN0QixNQUFNLFFBQVEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDO01BQzdCLElBQUksT0FBTztRQUNULE1BQU07VUFBQztVQUFLO1NBQU07TUFDcEI7SUFDRjtFQUNGO0FBQ0YifQ==