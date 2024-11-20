/**
 * Tokenizer results.
 */ /**
 * Tokenize input string.
 */ function lexer(str) {
  const tokens = [];
  let i = 0;
  while(i < str.length){
    const char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({
        type: "MODIFIER",
        index: i,
        value: str[i++]
      });
      continue;
    }
    if (char === "\\") {
      tokens.push({
        type: "ESCAPED_CHAR",
        index: i++,
        value: str[i++]
      });
      continue;
    }
    if (char === "{") {
      tokens.push({
        type: "OPEN",
        index: i,
        value: str[i++]
      });
      continue;
    }
    if (char === "}") {
      tokens.push({
        type: "CLOSE",
        index: i,
        value: str[i++]
      });
      continue;
    }
    if (char === ":") {
      let name = "";
      let j = i + 1;
      while(j < str.length){
        const code = str.charCodeAt(j);
        if (// `0-9`
        code >= 48 && code <= 57 || // `A-Z`
        code >= 65 && code <= 90 || // `a-z`
        code >= 97 && code <= 122 || // `_`
        code === 95) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name) throw new TypeError(`Missing parameter name at ${i}`);
      tokens.push({
        type: "NAME",
        index: i,
        value: name
      });
      i = j;
      continue;
    }
    if (char === "(") {
      let count = 1;
      let pattern = "";
      let j = i + 1;
      if (str[j] === "?") {
        throw new TypeError(`Pattern cannot start with "?" at ${j}`);
      }
      while(j < str.length){
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError(`Capturing groups are not allowed at ${j}`);
          }
        }
        pattern += str[j++];
      }
      if (count) throw new TypeError(`Unbalanced pattern at ${i}`);
      if (!pattern) throw new TypeError(`Missing pattern at ${i}`);
      tokens.push({
        type: "PATTERN",
        index: i,
        value: pattern
      });
      i = j;
      continue;
    }
    tokens.push({
      type: "CHAR",
      index: i,
      value: str[i++]
    });
  }
  tokens.push({
    type: "END",
    index: i,
    value: ""
  });
  return tokens;
}
/**
 * Parse a string for the raw tokens.
 */ export function parse(str, options = {}) {
  const tokens = lexer(str);
  const { prefixes = "./" } = options;
  const defaultPattern = `[^${escapeString(options.delimiter || "/#?")}]+?`;
  const result = [];
  let key = 0;
  let i = 0;
  let path = "";
  const tryConsume = (type)=>{
    if (i < tokens.length && tokens[i].type === type) return tokens[i++].value;
  };
  const mustConsume = (type)=>{
    const value = tryConsume(type);
    if (value !== undefined) return value;
    const { type: nextType, index } = tokens[i];
    throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
  };
  const consumeText = ()=>{
    let result = "";
    let value;
    while(value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")){
      result += value;
    }
    return result;
  };
  while(i < tokens.length){
    const char = tryConsume("CHAR");
    const name = tryConsume("NAME");
    const pattern = tryConsume("PATTERN");
    if (name || pattern) {
      let prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || defaultPattern,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    const value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    const open = tryConsume("OPEN");
    if (open) {
      const prefix = consumeText();
      const name = tryConsume("NAME") || "";
      const pattern = tryConsume("PATTERN") || "";
      const suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name || (pattern ? key++ : ""),
        pattern: name && !pattern ? defaultPattern : pattern,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
/**
 * Compile a string to a template function for the path.
 */ export function compile(str, options) {
  return tokensToFunction(parse(str, options), options);
}
/**
 * Expose a method for transforming tokens into the path function.
 */ export function tokensToFunction(tokens, options = {}) {
  const reFlags = flags(options);
  const { encode = (x)=>x, validate = true } = options;
  // Compile all the tokens into regexps.
  const matches = tokens.map((token)=>{
    if (typeof token === "object") {
      return new RegExp(`^(?:${token.pattern})$`, reFlags);
    }
  });
  return (data)=>{
    let path = "";
    for(let i = 0; i < tokens.length; i++){
      const token = tokens[i];
      if (typeof token === "string") {
        path += token;
        continue;
      }
      const value = data ? data[token.name] : undefined;
      const optional = token.modifier === "?" || token.modifier === "*";
      const repeat = token.modifier === "*" || token.modifier === "+";
      if (Array.isArray(value)) {
        if (!repeat) {
          throw new TypeError(`Expected "${token.name}" to not repeat, but got an array`);
        }
        if (value.length === 0) {
          if (optional) continue;
          throw new TypeError(`Expected "${token.name}" to not be empty`);
        }
        for(let j = 0; j < value.length; j++){
          const segment = encode(value[j], token);
          if (validate && !matches[i].test(segment)) {
            throw new TypeError(`Expected all "${token.name}" to match "${token.pattern}", but got "${segment}"`);
          }
          path += token.prefix + segment + token.suffix;
        }
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        const segment = encode(String(value), token);
        if (validate && !matches[i].test(segment)) {
          throw new TypeError(`Expected "${token.name}" to match "${token.pattern}", but got "${segment}"`);
        }
        path += token.prefix + segment + token.suffix;
        continue;
      }
      if (optional) continue;
      const typeOfMessage = repeat ? "an array" : "a string";
      throw new TypeError(`Expected "${token.name}" to be ${typeOfMessage}`);
    }
    return path;
  };
}
/**
 * Create path match function from `path-to-regexp` spec.
 */ export function match(str, options) {
  const keys = [];
  const re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
/**
 * Create a path match function from `path-to-regexp` output.
 */ export function regexpToFunction(re, keys, options = {}) {
  const { decode = (x)=>x } = options;
  return function(pathname) {
    const m = re.exec(pathname);
    if (!m) return false;
    const { 0: path, index } = m;
    const params = Object.create(null);
    for(let i = 1; i < m.length; i++){
      if (m[i] === undefined) continue;
      const key = keys[i - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i].split(key.prefix + key.suffix).map((value)=>{
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i], key);
      }
    }
    return {
      path,
      index,
      params
    };
  };
}
/**
 * Escape a regular expression string.
 */ function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */ function flags(options) {
  return options && options.sensitive ? "" : "i";
}
/**
 * Pull out keys from a regexp.
 */ function regexpToRegexp(path, keys) {
  if (!keys) return path;
  const groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  let index = 0;
  let execResult = groupsRegex.exec(path.source);
  while(execResult){
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
/**
 * Transform an array into a regexp.
 */ function arrayToRegexp(paths, keys, options) {
  const parts = paths.map((path)=>pathToRegexp(path, keys, options).source);
  return new RegExp(`(?:${parts.join("|")})`, flags(options));
}
/**
 * Create a path regexp from string input.
 */ function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
/**
 * Expose a function for taking tokens and returning a RegExp.
 */ export function tokensToRegexp(tokens, keys, options = {}) {
  const { strict = false, start = true, end = true, encode = (x)=>x, delimiter = "/#?", endsWith = "" } = options;
  const endsWithRe = `[${escapeString(endsWith)}]|$`;
  const delimiterRe = `[${escapeString(delimiter)}]`;
  let route = start ? "^" : "";
  // Iterate over the tokens and create our regexp string.
  for (const token of tokens){
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      const prefix = escapeString(encode(token.prefix));
      const suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys) keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            const mod = token.modifier === "*" ? "?" : "";
            route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
          } else {
            route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            route += `((?:${token.pattern})${token.modifier})`;
          } else {
            route += `(${token.pattern})${token.modifier}`;
          }
        }
      } else {
        route += `(?:${prefix}${suffix})${token.modifier}`;
      }
    }
  }
  if (end) {
    if (!strict) route += `${delimiterRe}?`;
    route += !options.endsWith ? "$" : `(?=${endsWithRe})`;
  } else {
    const endToken = tokens[tokens.length - 1];
    const isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === undefined;
    if (!strict) {
      route += `(?:${delimiterRe}(?=${endsWithRe}))?`;
    }
    if (!isEndDelimited) {
      route += `(?=${delimiterRe}|${endsWithRe})`;
    }
  }
  return new RegExp(route, flags(options));
}
/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 */ export function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp) return regexpToRegexp(path, keys);
  if (Array.isArray(path)) return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcGF0aF90b19yZWdleHBAdjYuMi4xL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVG9rZW5pemVyIHJlc3VsdHMuXG4gKi9cbmludGVyZmFjZSBMZXhUb2tlbiB7XG4gIHR5cGU6XG4gICAgfCBcIk9QRU5cIlxuICAgIHwgXCJDTE9TRVwiXG4gICAgfCBcIlBBVFRFUk5cIlxuICAgIHwgXCJOQU1FXCJcbiAgICB8IFwiQ0hBUlwiXG4gICAgfCBcIkVTQ0FQRURfQ0hBUlwiXG4gICAgfCBcIk1PRElGSUVSXCJcbiAgICB8IFwiRU5EXCI7XG4gIGluZGV4OiBudW1iZXI7XG4gIHZhbHVlOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVG9rZW5pemUgaW5wdXQgc3RyaW5nLlxuICovXG5mdW5jdGlvbiBsZXhlcihzdHI6IHN0cmluZyk6IExleFRva2VuW10ge1xuICBjb25zdCB0b2tlbnM6IExleFRva2VuW10gPSBbXTtcbiAgbGV0IGkgPSAwO1xuXG4gIHdoaWxlIChpIDwgc3RyLmxlbmd0aCkge1xuICAgIGNvbnN0IGNoYXIgPSBzdHJbaV07XG5cbiAgICBpZiAoY2hhciA9PT0gXCIqXCIgfHwgY2hhciA9PT0gXCIrXCIgfHwgY2hhciA9PT0gXCI/XCIpIHtcbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJNT0RJRklFUlwiLCBpbmRleDogaSwgdmFsdWU6IHN0cltpKytdIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiXFxcXFwiKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwiRVNDQVBFRF9DSEFSXCIsIGluZGV4OiBpKyssIHZhbHVlOiBzdHJbaSsrXSB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIntcIikge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcIk9QRU5cIiwgaW5kZXg6IGksIHZhbHVlOiBzdHJbaSsrXSB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjaGFyID09PSBcIn1cIikge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcIkNMT1NFXCIsIGluZGV4OiBpLCB2YWx1ZTogc3RyW2krK10gfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoY2hhciA9PT0gXCI6XCIpIHtcbiAgICAgIGxldCBuYW1lID0gXCJcIjtcbiAgICAgIGxldCBqID0gaSArIDE7XG5cbiAgICAgIHdoaWxlIChqIDwgc3RyLmxlbmd0aCkge1xuICAgICAgICBjb25zdCBjb2RlID0gc3RyLmNoYXJDb2RlQXQoaik7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIC8vIGAwLTlgXG4gICAgICAgICAgKGNvZGUgPj0gNDggJiYgY29kZSA8PSA1NykgfHxcbiAgICAgICAgICAvLyBgQS1aYFxuICAgICAgICAgIChjb2RlID49IDY1ICYmIGNvZGUgPD0gOTApIHx8XG4gICAgICAgICAgLy8gYGEtemBcbiAgICAgICAgICAoY29kZSA+PSA5NyAmJiBjb2RlIDw9IDEyMikgfHxcbiAgICAgICAgICAvLyBgX2BcbiAgICAgICAgICBjb2RlID09PSA5NVxuICAgICAgICApIHtcbiAgICAgICAgICBuYW1lICs9IHN0cltqKytdO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmICghbmFtZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihgTWlzc2luZyBwYXJhbWV0ZXIgbmFtZSBhdCAke2l9YCk7XG5cbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJOQU1FXCIsIGluZGV4OiBpLCB2YWx1ZTogbmFtZSB9KTtcbiAgICAgIGkgPSBqO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKGNoYXIgPT09IFwiKFwiKSB7XG4gICAgICBsZXQgY291bnQgPSAxO1xuICAgICAgbGV0IHBhdHRlcm4gPSBcIlwiO1xuICAgICAgbGV0IGogPSBpICsgMTtcblxuICAgICAgaWYgKHN0cltqXSA9PT0gXCI/XCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGF0dGVybiBjYW5ub3Qgc3RhcnQgd2l0aCBcIj9cIiBhdCAke2p9YCk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlIChqIDwgc3RyLmxlbmd0aCkge1xuICAgICAgICBpZiAoc3RyW2pdID09PSBcIlxcXFxcIikge1xuICAgICAgICAgIHBhdHRlcm4gKz0gc3RyW2orK10gKyBzdHJbaisrXTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdHJbal0gPT09IFwiKVwiKSB7XG4gICAgICAgICAgY291bnQtLTtcbiAgICAgICAgICBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChzdHJbal0gPT09IFwiKFwiKSB7XG4gICAgICAgICAgY291bnQrKztcbiAgICAgICAgICBpZiAoc3RyW2ogKyAxXSAhPT0gXCI/XCIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYENhcHR1cmluZyBncm91cHMgYXJlIG5vdCBhbGxvd2VkIGF0ICR7an1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBwYXR0ZXJuICs9IHN0cltqKytdO1xuICAgICAgfVxuXG4gICAgICBpZiAoY291bnQpIHRocm93IG5ldyBUeXBlRXJyb3IoYFVuYmFsYW5jZWQgcGF0dGVybiBhdCAke2l9YCk7XG4gICAgICBpZiAoIXBhdHRlcm4pIHRocm93IG5ldyBUeXBlRXJyb3IoYE1pc3NpbmcgcGF0dGVybiBhdCAke2l9YCk7XG5cbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJQQVRURVJOXCIsIGluZGV4OiBpLCB2YWx1ZTogcGF0dGVybiB9KTtcbiAgICAgIGkgPSBqO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcIkNIQVJcIiwgaW5kZXg6IGksIHZhbHVlOiBzdHJbaSsrXSB9KTtcbiAgfVxuXG4gIHRva2Vucy5wdXNoKHsgdHlwZTogXCJFTkRcIiwgaW5kZXg6IGksIHZhbHVlOiBcIlwiIH0pO1xuXG4gIHJldHVybiB0b2tlbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VPcHRpb25zIHtcbiAgLyoqXG4gICAqIFNldCB0aGUgZGVmYXVsdCBkZWxpbWl0ZXIgZm9yIHJlcGVhdCBwYXJhbWV0ZXJzLiAoZGVmYXVsdDogYCcvJ2ApXG4gICAqL1xuICBkZWxpbWl0ZXI/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNoYXJhY3RlcnMgdG8gYXV0b21hdGljYWxseSBjb25zaWRlciBwcmVmaXhlcyB3aGVuIHBhcnNpbmcuXG4gICAqL1xuICBwcmVmaXhlcz86IHN0cmluZztcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHN0cmluZyBmb3IgdGhlIHJhdyB0b2tlbnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZShzdHI6IHN0cmluZywgb3B0aW9uczogUGFyc2VPcHRpb25zID0ge30pOiBUb2tlbltdIHtcbiAgY29uc3QgdG9rZW5zID0gbGV4ZXIoc3RyKTtcbiAgY29uc3QgeyBwcmVmaXhlcyA9IFwiLi9cIiB9ID0gb3B0aW9ucztcbiAgY29uc3QgZGVmYXVsdFBhdHRlcm4gPSBgW14ke2VzY2FwZVN0cmluZyhvcHRpb25zLmRlbGltaXRlciB8fCBcIi8jP1wiKX1dKz9gO1xuICBjb25zdCByZXN1bHQ6IFRva2VuW10gPSBbXTtcbiAgbGV0IGtleSA9IDA7XG4gIGxldCBpID0gMDtcbiAgbGV0IHBhdGggPSBcIlwiO1xuXG4gIGNvbnN0IHRyeUNvbnN1bWUgPSAodHlwZTogTGV4VG9rZW5bXCJ0eXBlXCJdKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcbiAgICBpZiAoaSA8IHRva2Vucy5sZW5ndGggJiYgdG9rZW5zW2ldLnR5cGUgPT09IHR5cGUpIHJldHVybiB0b2tlbnNbaSsrXS52YWx1ZTtcbiAgfTtcblxuICBjb25zdCBtdXN0Q29uc3VtZSA9ICh0eXBlOiBMZXhUb2tlbltcInR5cGVcIl0pOiBzdHJpbmcgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gdHJ5Q29uc3VtZSh0eXBlKTtcbiAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkgcmV0dXJuIHZhbHVlO1xuICAgIGNvbnN0IHsgdHlwZTogbmV4dFR5cGUsIGluZGV4IH0gPSB0b2tlbnNbaV07XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVW5leHBlY3RlZCAke25leHRUeXBlfSBhdCAke2luZGV4fSwgZXhwZWN0ZWQgJHt0eXBlfWApO1xuICB9O1xuXG4gIGNvbnN0IGNvbnN1bWVUZXh0ID0gKCk6IHN0cmluZyA9PiB7XG4gICAgbGV0IHJlc3VsdCA9IFwiXCI7XG4gICAgbGV0IHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgd2hpbGUgKCh2YWx1ZSA9IHRyeUNvbnN1bWUoXCJDSEFSXCIpIHx8IHRyeUNvbnN1bWUoXCJFU0NBUEVEX0NIQVJcIikpKSB7XG4gICAgICByZXN1bHQgKz0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgd2hpbGUgKGkgPCB0b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgY2hhciA9IHRyeUNvbnN1bWUoXCJDSEFSXCIpO1xuICAgIGNvbnN0IG5hbWUgPSB0cnlDb25zdW1lKFwiTkFNRVwiKTtcbiAgICBjb25zdCBwYXR0ZXJuID0gdHJ5Q29uc3VtZShcIlBBVFRFUk5cIik7XG5cbiAgICBpZiAobmFtZSB8fCBwYXR0ZXJuKSB7XG4gICAgICBsZXQgcHJlZml4ID0gY2hhciB8fCBcIlwiO1xuXG4gICAgICBpZiAocHJlZml4ZXMuaW5kZXhPZihwcmVmaXgpID09PSAtMSkge1xuICAgICAgICBwYXRoICs9IHByZWZpeDtcbiAgICAgICAgcHJlZml4ID0gXCJcIjtcbiAgICAgIH1cblxuICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgcmVzdWx0LnB1c2gocGF0aCk7XG4gICAgICAgIHBhdGggPSBcIlwiO1xuICAgICAgfVxuXG4gICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgIG5hbWU6IG5hbWUgfHwga2V5KyssXG4gICAgICAgIHByZWZpeCxcbiAgICAgICAgc3VmZml4OiBcIlwiLFxuICAgICAgICBwYXR0ZXJuOiBwYXR0ZXJuIHx8IGRlZmF1bHRQYXR0ZXJuLFxuICAgICAgICBtb2RpZmllcjogdHJ5Q29uc3VtZShcIk1PRElGSUVSXCIpIHx8IFwiXCIsXG4gICAgICB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlID0gY2hhciB8fCB0cnlDb25zdW1lKFwiRVNDQVBFRF9DSEFSXCIpO1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgcGF0aCArPSB2YWx1ZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChwYXRoKSB7XG4gICAgICByZXN1bHQucHVzaChwYXRoKTtcbiAgICAgIHBhdGggPSBcIlwiO1xuICAgIH1cblxuICAgIGNvbnN0IG9wZW4gPSB0cnlDb25zdW1lKFwiT1BFTlwiKTtcbiAgICBpZiAob3Blbikge1xuICAgICAgY29uc3QgcHJlZml4ID0gY29uc3VtZVRleHQoKTtcbiAgICAgIGNvbnN0IG5hbWUgPSB0cnlDb25zdW1lKFwiTkFNRVwiKSB8fCBcIlwiO1xuICAgICAgY29uc3QgcGF0dGVybiA9IHRyeUNvbnN1bWUoXCJQQVRURVJOXCIpIHx8IFwiXCI7XG4gICAgICBjb25zdCBzdWZmaXggPSBjb25zdW1lVGV4dCgpO1xuXG4gICAgICBtdXN0Q29uc3VtZShcIkNMT1NFXCIpO1xuXG4gICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgIG5hbWU6IG5hbWUgfHwgKHBhdHRlcm4gPyBrZXkrKyA6IFwiXCIpLFxuICAgICAgICBwYXR0ZXJuOiBuYW1lICYmICFwYXR0ZXJuID8gZGVmYXVsdFBhdHRlcm4gOiBwYXR0ZXJuLFxuICAgICAgICBwcmVmaXgsXG4gICAgICAgIHN1ZmZpeCxcbiAgICAgICAgbW9kaWZpZXI6IHRyeUNvbnN1bWUoXCJNT0RJRklFUlwiKSB8fCBcIlwiLFxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBtdXN0Q29uc3VtZShcIkVORFwiKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9rZW5zVG9GdW5jdGlvbk9wdGlvbnMge1xuICAvKipcbiAgICogV2hlbiBgdHJ1ZWAgdGhlIHJlZ2V4cCB3aWxsIGJlIGNhc2Ugc2Vuc2l0aXZlLiAoZGVmYXVsdDogYGZhbHNlYClcbiAgICovXG4gIHNlbnNpdGl2ZT86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBGdW5jdGlvbiBmb3IgZW5jb2RpbmcgaW5wdXQgc3RyaW5ncyBmb3Igb3V0cHV0LlxuICAgKi9cbiAgZW5jb2RlPzogKHZhbHVlOiBzdHJpbmcsIHRva2VuOiBLZXkpID0+IHN0cmluZztcbiAgLyoqXG4gICAqIFdoZW4gYGZhbHNlYCB0aGUgZnVuY3Rpb24gY2FuIHByb2R1Y2UgYW4gaW52YWxpZCAodW5tYXRjaGVkKSBwYXRoLiAoZGVmYXVsdDogYHRydWVgKVxuICAgKi9cbiAgdmFsaWRhdGU/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBzdHJpbmcgdG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiBmb3IgdGhlIHBhdGguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlPFAgZXh0ZW5kcyBvYmplY3QgPSBvYmplY3Q+KFxuICBzdHI6IHN0cmluZyxcbiAgb3B0aW9ucz86IFBhcnNlT3B0aW9ucyAmIFRva2Vuc1RvRnVuY3Rpb25PcHRpb25zXG4pIHtcbiAgcmV0dXJuIHRva2Vuc1RvRnVuY3Rpb248UD4ocGFyc2Uoc3RyLCBvcHRpb25zKSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCB0eXBlIFBhdGhGdW5jdGlvbjxQIGV4dGVuZHMgb2JqZWN0ID0gb2JqZWN0PiA9IChkYXRhPzogUCkgPT4gc3RyaW5nO1xuXG4vKipcbiAqIEV4cG9zZSBhIG1ldGhvZCBmb3IgdHJhbnNmb3JtaW5nIHRva2VucyBpbnRvIHRoZSBwYXRoIGZ1bmN0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9rZW5zVG9GdW5jdGlvbjxQIGV4dGVuZHMgb2JqZWN0ID0gb2JqZWN0PihcbiAgdG9rZW5zOiBUb2tlbltdLFxuICBvcHRpb25zOiBUb2tlbnNUb0Z1bmN0aW9uT3B0aW9ucyA9IHt9XG4pOiBQYXRoRnVuY3Rpb248UD4ge1xuICBjb25zdCByZUZsYWdzID0gZmxhZ3Mob3B0aW9ucyk7XG4gIGNvbnN0IHsgZW5jb2RlID0gKHg6IHN0cmluZykgPT4geCwgdmFsaWRhdGUgPSB0cnVlIH0gPSBvcHRpb25zO1xuXG4gIC8vIENvbXBpbGUgYWxsIHRoZSB0b2tlbnMgaW50byByZWdleHBzLlxuICBjb25zdCBtYXRjaGVzID0gdG9rZW5zLm1hcCgodG9rZW4pID0+IHtcbiAgICBpZiAodHlwZW9mIHRva2VuID09PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gbmV3IFJlZ0V4cChgXig/OiR7dG9rZW4ucGF0dGVybn0pJGAsIHJlRmxhZ3MpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIChkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgbnVsbCB8IHVuZGVmaW5lZCkgPT4ge1xuICAgIGxldCBwYXRoID0gXCJcIjtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcblxuICAgICAgaWYgKHR5cGVvZiB0b2tlbiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBwYXRoICs9IHRva2VuO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdmFsdWUgPSBkYXRhID8gZGF0YVt0b2tlbi5uYW1lXSA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IG9wdGlvbmFsID0gdG9rZW4ubW9kaWZpZXIgPT09IFwiP1wiIHx8IHRva2VuLm1vZGlmaWVyID09PSBcIipcIjtcbiAgICAgIGNvbnN0IHJlcGVhdCA9IHRva2VuLm1vZGlmaWVyID09PSBcIipcIiB8fCB0b2tlbi5tb2RpZmllciA9PT0gXCIrXCI7XG5cbiAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBpZiAoIXJlcGVhdCkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgICBgRXhwZWN0ZWQgXCIke3Rva2VuLm5hbWV9XCIgdG8gbm90IHJlcGVhdCwgYnV0IGdvdCBhbiBhcnJheWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmIChvcHRpb25hbCkgY29udGludWU7XG5cbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCBcIiR7dG9rZW4ubmFtZX1cIiB0byBub3QgYmUgZW1wdHlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBzZWdtZW50ID0gZW5jb2RlKHZhbHVlW2pdLCB0b2tlbik7XG5cbiAgICAgICAgICBpZiAodmFsaWRhdGUgJiYgIShtYXRjaGVzW2ldIGFzIFJlZ0V4cCkudGVzdChzZWdtZW50KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgICAgYEV4cGVjdGVkIGFsbCBcIiR7dG9rZW4ubmFtZX1cIiB0byBtYXRjaCBcIiR7dG9rZW4ucGF0dGVybn1cIiwgYnV0IGdvdCBcIiR7c2VnbWVudH1cImBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcGF0aCArPSB0b2tlbi5wcmVmaXggKyBzZWdtZW50ICsgdG9rZW4uc3VmZml4O1xuICAgICAgICB9XG5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIgfHwgdHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnQgPSBlbmNvZGUoU3RyaW5nKHZhbHVlKSwgdG9rZW4pO1xuXG4gICAgICAgIGlmICh2YWxpZGF0ZSAmJiAhKG1hdGNoZXNbaV0gYXMgUmVnRXhwKS50ZXN0KHNlZ21lbnQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIGBFeHBlY3RlZCBcIiR7dG9rZW4ubmFtZX1cIiB0byBtYXRjaCBcIiR7dG9rZW4ucGF0dGVybn1cIiwgYnV0IGdvdCBcIiR7c2VnbWVudH1cImBcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcGF0aCArPSB0b2tlbi5wcmVmaXggKyBzZWdtZW50ICsgdG9rZW4uc3VmZml4O1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbmFsKSBjb250aW51ZTtcblxuICAgICAgY29uc3QgdHlwZU9mTWVzc2FnZSA9IHJlcGVhdCA/IFwiYW4gYXJyYXlcIiA6IFwiYSBzdHJpbmdcIjtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIFwiJHt0b2tlbi5uYW1lfVwiIHRvIGJlICR7dHlwZU9mTWVzc2FnZX1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aDtcbiAgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWdleHBUb0Z1bmN0aW9uT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBGdW5jdGlvbiBmb3IgZGVjb2Rpbmcgc3RyaW5ncyBmb3IgcGFyYW1zLlxuICAgKi9cbiAgZGVjb2RlPzogKHZhbHVlOiBzdHJpbmcsIHRva2VuOiBLZXkpID0+IHN0cmluZztcbn1cblxuLyoqXG4gKiBBIG1hdGNoIHJlc3VsdCBjb250YWlucyBkYXRhIGFib3V0IHRoZSBwYXRoIG1hdGNoLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1hdGNoUmVzdWx0PFAgZXh0ZW5kcyBvYmplY3QgPSBvYmplY3Q+IHtcbiAgcGF0aDogc3RyaW5nO1xuICBpbmRleDogbnVtYmVyO1xuICBwYXJhbXM6IFA7XG59XG5cbi8qKlxuICogQSBtYXRjaCBpcyBlaXRoZXIgYGZhbHNlYCAobm8gbWF0Y2gpIG9yIGEgbWF0Y2ggcmVzdWx0LlxuICovXG5leHBvcnQgdHlwZSBNYXRjaDxQIGV4dGVuZHMgb2JqZWN0ID0gb2JqZWN0PiA9IGZhbHNlIHwgTWF0Y2hSZXN1bHQ8UD47XG5cbi8qKlxuICogVGhlIG1hdGNoIGZ1bmN0aW9uIHRha2VzIGEgc3RyaW5nIGFuZCByZXR1cm5zIHdoZXRoZXIgaXQgbWF0Y2hlZCB0aGUgcGF0aC5cbiAqL1xuZXhwb3J0IHR5cGUgTWF0Y2hGdW5jdGlvbjxQIGV4dGVuZHMgb2JqZWN0ID0gb2JqZWN0PiA9IChcbiAgcGF0aDogc3RyaW5nXG4pID0+IE1hdGNoPFA+O1xuXG4vKipcbiAqIENyZWF0ZSBwYXRoIG1hdGNoIGZ1bmN0aW9uIGZyb20gYHBhdGgtdG8tcmVnZXhwYCBzcGVjLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF0Y2g8UCBleHRlbmRzIG9iamVjdCA9IG9iamVjdD4oXG4gIHN0cjogUGF0aCxcbiAgb3B0aW9ucz86IFBhcnNlT3B0aW9ucyAmIFRva2Vuc1RvUmVnZXhwT3B0aW9ucyAmIFJlZ2V4cFRvRnVuY3Rpb25PcHRpb25zXG4pIHtcbiAgY29uc3Qga2V5czogS2V5W10gPSBbXTtcbiAgY29uc3QgcmUgPSBwYXRoVG9SZWdleHAoc3RyLCBrZXlzLCBvcHRpb25zKTtcbiAgcmV0dXJuIHJlZ2V4cFRvRnVuY3Rpb248UD4ocmUsIGtleXMsIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHBhdGggbWF0Y2ggZnVuY3Rpb24gZnJvbSBgcGF0aC10by1yZWdleHBgIG91dHB1dC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2V4cFRvRnVuY3Rpb248UCBleHRlbmRzIG9iamVjdCA9IG9iamVjdD4oXG4gIHJlOiBSZWdFeHAsXG4gIGtleXM6IEtleVtdLFxuICBvcHRpb25zOiBSZWdleHBUb0Z1bmN0aW9uT3B0aW9ucyA9IHt9XG4pOiBNYXRjaEZ1bmN0aW9uPFA+IHtcbiAgY29uc3QgeyBkZWNvZGUgPSAoeDogc3RyaW5nKSA9PiB4IH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiBmdW5jdGlvbiAocGF0aG5hbWU6IHN0cmluZykge1xuICAgIGNvbnN0IG0gPSByZS5leGVjKHBhdGhuYW1lKTtcbiAgICBpZiAoIW0pIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHsgMDogcGF0aCwgaW5kZXggfSA9IG07XG4gICAgY29uc3QgcGFyYW1zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgbS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKG1baV0gPT09IHVuZGVmaW5lZCkgY29udGludWU7XG5cbiAgICAgIGNvbnN0IGtleSA9IGtleXNbaSAtIDFdO1xuXG4gICAgICBpZiAoa2V5Lm1vZGlmaWVyID09PSBcIipcIiB8fCBrZXkubW9kaWZpZXIgPT09IFwiK1wiKSB7XG4gICAgICAgIHBhcmFtc1trZXkubmFtZV0gPSBtW2ldLnNwbGl0KGtleS5wcmVmaXggKyBrZXkuc3VmZml4KS5tYXAoKHZhbHVlKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGRlY29kZSh2YWx1ZSwga2V5KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJhbXNba2V5Lm5hbWVdID0gZGVjb2RlKG1baV0sIGtleSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgcGF0aCwgaW5kZXgsIHBhcmFtcyB9O1xuICB9O1xufVxuXG4vKipcbiAqIEVzY2FwZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBzdHJpbmcuXG4gKi9cbmZ1bmN0aW9uIGVzY2FwZVN0cmluZyhzdHI6IHN0cmluZykge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLyhbLisqPz1eIToke30oKVtcXF18L1xcXFxdKS9nLCBcIlxcXFwkMVwiKTtcbn1cblxuLyoqXG4gKiBHZXQgdGhlIGZsYWdzIGZvciBhIHJlZ2V4cCBmcm9tIHRoZSBvcHRpb25zLlxuICovXG5mdW5jdGlvbiBmbGFncyhvcHRpb25zPzogeyBzZW5zaXRpdmU/OiBib29sZWFuIH0pIHtcbiAgcmV0dXJuIG9wdGlvbnMgJiYgb3B0aW9ucy5zZW5zaXRpdmUgPyBcIlwiIDogXCJpXCI7XG59XG5cbi8qKlxuICogTWV0YWRhdGEgYWJvdXQgYSBrZXkuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgS2V5IHtcbiAgbmFtZTogc3RyaW5nIHwgbnVtYmVyO1xuICBwcmVmaXg6IHN0cmluZztcbiAgc3VmZml4OiBzdHJpbmc7XG4gIHBhdHRlcm46IHN0cmluZztcbiAgbW9kaWZpZXI6IHN0cmluZztcbn1cblxuLyoqXG4gKiBBIHRva2VuIGlzIGEgc3RyaW5nIChub3RoaW5nIHNwZWNpYWwpIG9yIGtleSBtZXRhZGF0YSAoY2FwdHVyZSBncm91cCkuXG4gKi9cbmV4cG9ydCB0eXBlIFRva2VuID0gc3RyaW5nIHwgS2V5O1xuXG4vKipcbiAqIFB1bGwgb3V0IGtleXMgZnJvbSBhIHJlZ2V4cC5cbiAqL1xuZnVuY3Rpb24gcmVnZXhwVG9SZWdleHAocGF0aDogUmVnRXhwLCBrZXlzPzogS2V5W10pOiBSZWdFeHAge1xuICBpZiAoIWtleXMpIHJldHVybiBwYXRoO1xuXG4gIGNvbnN0IGdyb3Vwc1JlZ2V4ID0gL1xcKCg/OlxcPzwoLio/KT4pPyg/IVxcPykvZztcblxuICBsZXQgaW5kZXggPSAwO1xuICBsZXQgZXhlY1Jlc3VsdCA9IGdyb3Vwc1JlZ2V4LmV4ZWMocGF0aC5zb3VyY2UpO1xuICB3aGlsZSAoZXhlY1Jlc3VsdCkge1xuICAgIGtleXMucHVzaCh7XG4gICAgICAvLyBVc2UgcGFyZW50aGVzaXplZCBzdWJzdHJpbmcgbWF0Y2ggaWYgYXZhaWxhYmxlLCBpbmRleCBvdGhlcndpc2VcbiAgICAgIG5hbWU6IGV4ZWNSZXN1bHRbMV0gfHwgaW5kZXgrKyxcbiAgICAgIHByZWZpeDogXCJcIixcbiAgICAgIHN1ZmZpeDogXCJcIixcbiAgICAgIG1vZGlmaWVyOiBcIlwiLFxuICAgICAgcGF0dGVybjogXCJcIixcbiAgICB9KTtcbiAgICBleGVjUmVzdWx0ID0gZ3JvdXBzUmVnZXguZXhlYyhwYXRoLnNvdXJjZSk7XG4gIH1cblxuICByZXR1cm4gcGF0aDtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYW4gYXJyYXkgaW50byBhIHJlZ2V4cC5cbiAqL1xuZnVuY3Rpb24gYXJyYXlUb1JlZ2V4cChcbiAgcGF0aHM6IEFycmF5PHN0cmluZyB8IFJlZ0V4cD4sXG4gIGtleXM/OiBLZXlbXSxcbiAgb3B0aW9ucz86IFRva2Vuc1RvUmVnZXhwT3B0aW9ucyAmIFBhcnNlT3B0aW9uc1xuKTogUmVnRXhwIHtcbiAgY29uc3QgcGFydHMgPSBwYXRocy5tYXAoKHBhdGgpID0+IHBhdGhUb1JlZ2V4cChwYXRoLCBrZXlzLCBvcHRpb25zKS5zb3VyY2UpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChgKD86JHtwYXJ0cy5qb2luKFwifFwiKX0pYCwgZmxhZ3Mob3B0aW9ucykpO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHBhdGggcmVnZXhwIGZyb20gc3RyaW5nIGlucHV0LlxuICovXG5mdW5jdGlvbiBzdHJpbmdUb1JlZ2V4cChcbiAgcGF0aDogc3RyaW5nLFxuICBrZXlzPzogS2V5W10sXG4gIG9wdGlvbnM/OiBUb2tlbnNUb1JlZ2V4cE9wdGlvbnMgJiBQYXJzZU9wdGlvbnNcbikge1xuICByZXR1cm4gdG9rZW5zVG9SZWdleHAocGFyc2UocGF0aCwgb3B0aW9ucyksIGtleXMsIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRva2Vuc1RvUmVnZXhwT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBXaGVuIGB0cnVlYCB0aGUgcmVnZXhwIHdpbGwgYmUgY2FzZSBzZW5zaXRpdmUuIChkZWZhdWx0OiBgZmFsc2VgKVxuICAgKi9cbiAgc2Vuc2l0aXZlPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFdoZW4gYHRydWVgIHRoZSByZWdleHAgd29uJ3QgYWxsb3cgYW4gb3B0aW9uYWwgdHJhaWxpbmcgZGVsaW1pdGVyIHRvIG1hdGNoLiAoZGVmYXVsdDogYGZhbHNlYClcbiAgICovXG4gIHN0cmljdD86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBXaGVuIGB0cnVlYCB0aGUgcmVnZXhwIHdpbGwgbWF0Y2ggdG8gdGhlIGVuZCBvZiB0aGUgc3RyaW5nLiAoZGVmYXVsdDogYHRydWVgKVxuICAgKi9cbiAgZW5kPzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFdoZW4gYHRydWVgIHRoZSByZWdleHAgd2lsbCBtYXRjaCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIHN0cmluZy4gKGRlZmF1bHQ6IGB0cnVlYClcbiAgICovXG4gIHN0YXJ0PzogYm9vbGVhbjtcbiAgLyoqXG4gICAqIFNldHMgdGhlIGZpbmFsIGNoYXJhY3RlciBmb3Igbm9uLWVuZGluZyBvcHRpbWlzdGljIG1hdGNoZXMuIChkZWZhdWx0OiBgL2ApXG4gICAqL1xuICBkZWxpbWl0ZXI/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBMaXN0IG9mIGNoYXJhY3RlcnMgdGhhdCBjYW4gYWxzbyBiZSBcImVuZFwiIGNoYXJhY3RlcnMuXG4gICAqL1xuICBlbmRzV2l0aD86IHN0cmluZztcbiAgLyoqXG4gICAqIEVuY29kZSBwYXRoIHRva2VucyBmb3IgdXNlIGluIHRoZSBgUmVnRXhwYC5cbiAgICovXG4gIGVuY29kZT86ICh2YWx1ZTogc3RyaW5nKSA9PiBzdHJpbmc7XG59XG5cbi8qKlxuICogRXhwb3NlIGEgZnVuY3Rpb24gZm9yIHRha2luZyB0b2tlbnMgYW5kIHJldHVybmluZyBhIFJlZ0V4cC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRva2Vuc1RvUmVnZXhwKFxuICB0b2tlbnM6IFRva2VuW10sXG4gIGtleXM/OiBLZXlbXSxcbiAgb3B0aW9uczogVG9rZW5zVG9SZWdleHBPcHRpb25zID0ge31cbikge1xuICBjb25zdCB7XG4gICAgc3RyaWN0ID0gZmFsc2UsXG4gICAgc3RhcnQgPSB0cnVlLFxuICAgIGVuZCA9IHRydWUsXG4gICAgZW5jb2RlID0gKHg6IHN0cmluZykgPT4geCxcbiAgICBkZWxpbWl0ZXIgPSBcIi8jP1wiLFxuICAgIGVuZHNXaXRoID0gXCJcIixcbiAgfSA9IG9wdGlvbnM7XG4gIGNvbnN0IGVuZHNXaXRoUmUgPSBgWyR7ZXNjYXBlU3RyaW5nKGVuZHNXaXRoKX1dfCRgO1xuICBjb25zdCBkZWxpbWl0ZXJSZSA9IGBbJHtlc2NhcGVTdHJpbmcoZGVsaW1pdGVyKX1dYDtcbiAgbGV0IHJvdXRlID0gc3RhcnQgPyBcIl5cIiA6IFwiXCI7XG5cbiAgLy8gSXRlcmF0ZSBvdmVyIHRoZSB0b2tlbnMgYW5kIGNyZWF0ZSBvdXIgcmVnZXhwIHN0cmluZy5cbiAgZm9yIChjb25zdCB0b2tlbiBvZiB0b2tlbnMpIHtcbiAgICBpZiAodHlwZW9mIHRva2VuID09PSBcInN0cmluZ1wiKSB7XG4gICAgICByb3V0ZSArPSBlc2NhcGVTdHJpbmcoZW5jb2RlKHRva2VuKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHByZWZpeCA9IGVzY2FwZVN0cmluZyhlbmNvZGUodG9rZW4ucHJlZml4KSk7XG4gICAgICBjb25zdCBzdWZmaXggPSBlc2NhcGVTdHJpbmcoZW5jb2RlKHRva2VuLnN1ZmZpeCkpO1xuXG4gICAgICBpZiAodG9rZW4ucGF0dGVybikge1xuICAgICAgICBpZiAoa2V5cykga2V5cy5wdXNoKHRva2VuKTtcblxuICAgICAgICBpZiAocHJlZml4IHx8IHN1ZmZpeCkge1xuICAgICAgICAgIGlmICh0b2tlbi5tb2RpZmllciA9PT0gXCIrXCIgfHwgdG9rZW4ubW9kaWZpZXIgPT09IFwiKlwiKSB7XG4gICAgICAgICAgICBjb25zdCBtb2QgPSB0b2tlbi5tb2RpZmllciA9PT0gXCIqXCIgPyBcIj9cIiA6IFwiXCI7XG4gICAgICAgICAgICByb3V0ZSArPSBgKD86JHtwcmVmaXh9KCg/OiR7dG9rZW4ucGF0dGVybn0pKD86JHtzdWZmaXh9JHtwcmVmaXh9KD86JHt0b2tlbi5wYXR0ZXJufSkpKikke3N1ZmZpeH0pJHttb2R9YDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm91dGUgKz0gYCg/OiR7cHJlZml4fSgke3Rva2VuLnBhdHRlcm59KSR7c3VmZml4fSkke3Rva2VuLm1vZGlmaWVyfWA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0b2tlbi5tb2RpZmllciA9PT0gXCIrXCIgfHwgdG9rZW4ubW9kaWZpZXIgPT09IFwiKlwiKSB7XG4gICAgICAgICAgICByb3V0ZSArPSBgKCg/OiR7dG9rZW4ucGF0dGVybn0pJHt0b2tlbi5tb2RpZmllcn0pYDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm91dGUgKz0gYCgke3Rva2VuLnBhdHRlcm59KSR7dG9rZW4ubW9kaWZpZXJ9YDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJvdXRlICs9IGAoPzoke3ByZWZpeH0ke3N1ZmZpeH0pJHt0b2tlbi5tb2RpZmllcn1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChlbmQpIHtcbiAgICBpZiAoIXN0cmljdCkgcm91dGUgKz0gYCR7ZGVsaW1pdGVyUmV9P2A7XG5cbiAgICByb3V0ZSArPSAhb3B0aW9ucy5lbmRzV2l0aCA/IFwiJFwiIDogYCg/PSR7ZW5kc1dpdGhSZX0pYDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBlbmRUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgaXNFbmREZWxpbWl0ZWQgPVxuICAgICAgdHlwZW9mIGVuZFRva2VuID09PSBcInN0cmluZ1wiXG4gICAgICAgID8gZGVsaW1pdGVyUmUuaW5kZXhPZihlbmRUb2tlbltlbmRUb2tlbi5sZW5ndGggLSAxXSkgPiAtMVxuICAgICAgICA6IGVuZFRva2VuID09PSB1bmRlZmluZWQ7XG5cbiAgICBpZiAoIXN0cmljdCkge1xuICAgICAgcm91dGUgKz0gYCg/OiR7ZGVsaW1pdGVyUmV9KD89JHtlbmRzV2l0aFJlfSkpP2A7XG4gICAgfVxuXG4gICAgaWYgKCFpc0VuZERlbGltaXRlZCkge1xuICAgICAgcm91dGUgKz0gYCg/PSR7ZGVsaW1pdGVyUmV9fCR7ZW5kc1dpdGhSZX0pYDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3IFJlZ0V4cChyb3V0ZSwgZmxhZ3Mob3B0aW9ucykpO1xufVxuXG4vKipcbiAqIFN1cHBvcnRlZCBgcGF0aC10by1yZWdleHBgIGlucHV0IHR5cGVzLlxuICovXG5leHBvcnQgdHlwZSBQYXRoID0gc3RyaW5nIHwgUmVnRXhwIHwgQXJyYXk8c3RyaW5nIHwgUmVnRXhwPjtcblxuLyoqXG4gKiBOb3JtYWxpemUgdGhlIGdpdmVuIHBhdGggc3RyaW5nLCByZXR1cm5pbmcgYSByZWd1bGFyIGV4cHJlc3Npb24uXG4gKlxuICogQW4gZW1wdHkgYXJyYXkgY2FuIGJlIHBhc3NlZCBpbiBmb3IgdGhlIGtleXMsIHdoaWNoIHdpbGwgaG9sZCB0aGVcbiAqIHBsYWNlaG9sZGVyIGtleSBkZXNjcmlwdGlvbnMuIEZvciBleGFtcGxlLCB1c2luZyBgL3VzZXIvOmlkYCwgYGtleXNgIHdpbGxcbiAqIGNvbnRhaW4gYFt7IG5hbWU6ICdpZCcsIGRlbGltaXRlcjogJy8nLCBvcHRpb25hbDogZmFsc2UsIHJlcGVhdDogZmFsc2UgfV1gLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGF0aFRvUmVnZXhwKFxuICBwYXRoOiBQYXRoLFxuICBrZXlzPzogS2V5W10sXG4gIG9wdGlvbnM/OiBUb2tlbnNUb1JlZ2V4cE9wdGlvbnMgJiBQYXJzZU9wdGlvbnNcbikge1xuICBpZiAocGF0aCBpbnN0YW5jZW9mIFJlZ0V4cCkgcmV0dXJuIHJlZ2V4cFRvUmVnZXhwKHBhdGgsIGtleXMpO1xuICBpZiAoQXJyYXkuaXNBcnJheShwYXRoKSkgcmV0dXJuIGFycmF5VG9SZWdleHAocGF0aCwga2V5cywgb3B0aW9ucyk7XG4gIHJldHVybiBzdHJpbmdUb1JlZ2V4cChwYXRoLCBrZXlzLCBvcHRpb25zKTtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Q0FFQyxHQWVEOztDQUVDLEdBQ0QsU0FBUyxNQUFNLEdBQVc7RUFDeEIsTUFBTSxTQUFxQixFQUFFO0VBQzdCLElBQUksSUFBSTtFQUVSLE1BQU8sSUFBSSxJQUFJLE1BQU0sQ0FBRTtJQUNyQixNQUFNLE9BQU8sR0FBRyxDQUFDLEVBQUU7SUFFbkIsSUFBSSxTQUFTLE9BQU8sU0FBUyxPQUFPLFNBQVMsS0FBSztNQUNoRCxPQUFPLElBQUksQ0FBQztRQUFFLE1BQU07UUFBWSxPQUFPO1FBQUcsT0FBTyxHQUFHLENBQUMsSUFBSTtNQUFDO01BQzFEO0lBQ0Y7SUFFQSxJQUFJLFNBQVMsTUFBTTtNQUNqQixPQUFPLElBQUksQ0FBQztRQUFFLE1BQU07UUFBZ0IsT0FBTztRQUFLLE9BQU8sR0FBRyxDQUFDLElBQUk7TUFBQztNQUNoRTtJQUNGO0lBRUEsSUFBSSxTQUFTLEtBQUs7TUFDaEIsT0FBTyxJQUFJLENBQUM7UUFBRSxNQUFNO1FBQVEsT0FBTztRQUFHLE9BQU8sR0FBRyxDQUFDLElBQUk7TUFBQztNQUN0RDtJQUNGO0lBRUEsSUFBSSxTQUFTLEtBQUs7TUFDaEIsT0FBTyxJQUFJLENBQUM7UUFBRSxNQUFNO1FBQVMsT0FBTztRQUFHLE9BQU8sR0FBRyxDQUFDLElBQUk7TUFBQztNQUN2RDtJQUNGO0lBRUEsSUFBSSxTQUFTLEtBQUs7TUFDaEIsSUFBSSxPQUFPO01BQ1gsSUFBSSxJQUFJLElBQUk7TUFFWixNQUFPLElBQUksSUFBSSxNQUFNLENBQUU7UUFDckIsTUFBTSxPQUFPLElBQUksVUFBVSxDQUFDO1FBRTVCLElBRUUsQUFEQSxRQUFRO1FBQ1AsUUFBUSxNQUFNLFFBQVEsTUFDdkIsUUFBUTtRQUNQLFFBQVEsTUFBTSxRQUFRLE1B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