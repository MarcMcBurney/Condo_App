// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
// This module was heavily inspired by ua-parser-js
// (https://www.npmjs.com/package/ua-parser-js) which is MIT licensed and
// Copyright (c) 2012-2023 Faisal Salman <f@faisalman.com>
/** Provides {@linkcode UserAgent} and related types to be able to provide a
 * structured understanding of a user agent string.
 *
 * @module
 */ import { assert } from "../assert/assert.ts";
const ARCHITECTURE = "architecture";
const MODEL = "model";
const NAME = "name";
const TYPE = "type";
const VENDOR = "vendor";
const VERSION = "version";
const EMPTY = "";
const CONSOLE = "console";
const EMBEDDED = "embedded";
const MOBILE = "mobile";
const TABLET = "tablet";
const SMARTTV = "smarttv";
const WEARABLE = "wearable";
const PREFIX_MOBILE = "Mobile ";
const SUFFIX_BROWSER = " Browser";
const AMAZON = "Amazon";
const APPLE = "Apple";
const ASUS = "ASUS";
const BLACKBERRY = "BlackBerry";
const CHROME = "Chrome";
const EDGE = "Edge";
const FACEBOOK = "Facebook";
const FIREFOX = "Firefox";
const GOOGLE = "Google";
const HUAWEI = "Huawei";
const LG = "LG";
const MICROSOFT = "Microsoft";
const MOTOROLA = "Motorola";
const OPERA = "Opera";
const SAMSUNG = "Samsung";
const SHARP = "Sharp";
const SONY = "Sony";
const WINDOWS = "Windows";
const XIAOMI = "Xiaomi";
const ZEBRA = "Zebra";
function lowerize(str) {
  return str.toLowerCase();
}
function majorize(str) {
  return str ? str.replace(/[^\d\.]/g, EMPTY).split(".")[0] : undefined;
}
function trim(str) {
  return str.trimStart();
}
/** A map where the key is the common Windows version and the value is a string
 * or array of strings of potential values parsed from the user-agent string. */ const windowsVersionMap = new Map([
  [
    "ME",
    "4.90"
  ],
  [
    "NT 3.11",
    "NT3.51"
  ],
  [
    "NT 4.0",
    "NT4.0"
  ],
  [
    "2000",
    "NT 5.0"
  ],
  [
    "XP",
    [
      "NT 5.1",
      "NT 5.2"
    ]
  ],
  [
    "Vista",
    "NT 6.0"
  ],
  [
    "7",
    "NT 6.1"
  ],
  [
    "8",
    "NT 6.2"
  ],
  [
    "8.1",
    "NT 6.3"
  ],
  [
    "10",
    [
      "NT 6.4",
      "NT 10.0"
    ]
  ],
  [
    "RT",
    "ARM"
  ]
]);
function has(str1, str2) {
  if (Array.isArray(str1)) {
    for (const el of str1){
      if (lowerize(el) === lowerize(str2)) {
        return true;
      }
    }
    return false;
  }
  return lowerize(str2).indexOf(lowerize(str1)) !== -1;
}
function mapWinVer(str) {
  for (const [key, value] of windowsVersionMap){
    if (Array.isArray(value)) {
      for (const v of value){
        if (has(v, str)) {
          return key;
        }
      }
    } else if (has(value, str)) {
      return key;
    }
  }
  return str || undefined;
}
function mapper(// deno-lint-ignore no-explicit-any
target, ua, tuples) {
  let matches = null;
  for (const [matchers, processors] of tuples){
    let j = 0;
    let k = 0;
    while(j < matchers.length && !matches){
      if (!matchers[j]) {
        break;
      }
      matches = matchers[j++].exec(ua);
      if (matches) {
        for (const processor of processors){
          const match = matches[++k];
          if (Array.isArray(processor)) {
            if (processor.length === 2) {
              const [prop, value] = processor;
              if (typeof value === "function") {
                target[prop] = value.call(target, match);
              } else {
                target[prop] = value;
              }
            } else if (processor.length === 3) {
              const [prop, re, value] = processor;
              target[prop] = match ? match.replace(re, value) : undefined;
            } else {
              const [prop, re, value, fn] = processor;
              assert(fn);
              target[prop] = match ? fn.call(prop, match.replace(re, value)) : undefined;
            }
          } else {
            target[processor] = match ? match : undefined;
          }
        }
      }
    }
  }
}
/** An object with properties that are arrays of tuples which provide match
 * patterns and configuration on how to interpret the capture groups. */ const matchers = {
  browser: [
    [
      [
        /\b(?:crmo|crios)\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${PREFIX_MOBILE}${CHROME}`
        ]
      ]
    ],
    [
      [
        /edg(?:e|ios|a)?\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Edge"
        ]
      ]
    ],
    // Presto based
    [
      [
        /(opera mini)\/([-\w\.]+)/i,
        /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i,
        /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /opios[\/ ]+([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${OPERA} Mini`
        ]
      ]
    ],
    [
      [
        /\bopr\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          OPERA
        ]
      ]
    ],
    [
      [
        // Mixed
        /(kindle)\/([\w\.]+)/i,
        /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i,
        // Trident based
        /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i,
        /(ba?idubrowser)[\/ ]?([\w\.]+)/i,
        /(?:ms|\()(ie) ([\w\.]+)/i,
        // Webkit/KHTML based
        // Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS/Bowser/QupZilla/Falkon/Rekonq/Puffin/Brave/Whale/QQBrowserLite/QQ//Vivaldi/DuckDuckGo
        /(flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale(?!.+naver)|qqbrowserlite|qq|duckduckgo)\/([-\w\.]+)/i,
        /(heytap|ovi)browser\/([\d\.]+)/i,
        /(weibo)__([\d\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "UCBrowser"
        ]
      ]
    ],
    [
      [
        /microm.+\bqbcore\/([\w\.]+)/i,
        /\bqbcore\/([\w\.]+).+microm/i
      ],
      [
        VERSION,
        [
          NAME,
          "WeChat(Win) Desktop"
        ]
      ]
    ],
    [
      [
        /micromessenger\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "WeChat"
        ]
      ]
    ],
    [
      [
        /konqueror\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Konqueror"
        ]
      ]
    ],
    [
      [
        /trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i
      ],
      [
        VERSION,
        [
          NAME,
          "IE"
        ]
      ]
    ],
    [
      [
        /ya(?:search)?browser\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Yandex"
        ]
      ]
    ],
    [
      [
        /(avast|avg)\/([\w\.]+)/i
      ],
      [
        [
          NAME,
          /(.+)/,
          `$1 Secure${SUFFIX_BROWSER}`
        ],
        VERSION
      ]
    ],
    [
      [
        /\bfocus\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${FIREFOX} Focus`
        ]
      ]
    ],
    [
      [
        /\bopt\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${OPERA} Touch`
        ]
      ]
    ],
    [
      [
        /coc_coc\w+\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Coc Coc"
        ]
      ]
    ],
    [
      [
        /dolfin\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Dolphin"
        ]
      ]
    ],
    [
      [
        /coast\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${OPERA} Coast`
        ]
      ]
    ],
    [
      [
        /miuibrowser\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `MIUI${SUFFIX_BROWSER}`
        ]
      ]
    ],
    [
      [
        /fxios\/([\w\.-]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${PREFIX_MOBILE}${FIREFOX}`
        ]
      ]
    ],
    [
      [
        /\bqihu|(qi?ho?o?|360)browser/i
      ],
      [
        [
          NAME,
          `360${SUFFIX_BROWSER}`
        ]
      ]
    ],
    [
      [
        /(oculus|samsung|sailfish|huawei)browser\/([\w\.]+)/i
      ],
      [
        [
          NAME,
          /(.+)/,
          "$1" + SUFFIX_BROWSER
        ],
        VERSION
      ]
    ],
    [
      [
        /(comodo_dragon)\/([\w\.]+)/i
      ],
      [
        [
          NAME,
          /_/g,
          " "
        ],
        VERSION
      ]
    ],
    [
      [
        /(electron)\/([\w\.]+) safari/i,
        /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i,
        /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(metasr)[\/ ]?([\w\.]+)/i,
        /(lbbrowser)/i,
        /\[(linkedin)app\]/i
      ],
      [
        NAME
      ]
    ],
    [
      [
        /((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i
      ],
      [
        [
          NAME,
          FACEBOOK
        ],
        VERSION
      ]
    ],
    [
      [
        /(kakao(?:talk|story))[\/ ]([\w\.]+)/i,
        /(naver)\(.*?(\d+\.[\w\.]+).*\)/i,
        /safari (line)\/([\w\.]+)/i,
        /\b(line)\/([\w\.]+)\/iab/i,
        /(chromium|instagram)[\/ ]([-\w\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /\bgsa\/([\w\.]+) .*safari\//i
      ],
      [
        VERSION,
        [
          NAME,
          "GSA"
        ]
      ]
    ],
    [
      [
        /musical_ly(?:.+app_?version\/|_)([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "TikTok"
        ]
      ]
    ],
    [
      [
        /headlesschrome(?:\/([\w\.]+)| )/i
      ],
      [
        VERSION,
        [
          NAME,
          `${CHROME} Headless`
        ]
      ]
    ],
    [
      [
        / wv\).+(chrome)\/([\w\.]+)/i
      ],
      [
        [
          NAME,
          `${CHROME} WebView`
        ],
        VERSION
      ]
    ],
    [
      [
        /droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i
      ],
      [
        VERSION,
        [
          NAME,
          `Android${SUFFIX_BROWSER}`
        ]
      ]
    ],
    [
      [
        /chrome\/([\w\.]+) mobile/i
      ],
      [
        VERSION,
        [
          NAME,
          `${PREFIX_MOBILE}${CHROME}`
        ]
      ]
    ],
    [
      [
        /(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /version\/([\w\.\,]+) .*mobile(?:\/\w+ | ?)safari/i
      ],
      [
        VERSION,
        [
          NAME,
          `${PREFIX_MOBILE}Safari`
        ]
      ]
    ],
    [
      [
        /iphone .*mobile(?:\/\w+ | ?)safari/i
      ],
      [
        [
          NAME,
          `${PREFIX_MOBILE}Safari`
        ]
      ]
    ],
    [
      [
        /version\/([\w\.\,]+) .*(safari)/i
      ],
      [
        VERSION,
        NAME
      ]
    ],
    [
      [
        /webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i
      ],
      [
        NAME,
        [
          VERSION,
          "1"
        ]
      ]
    ],
    [
      [
        /(webkit|khtml)\/([\w\.]+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(?:mobile|tablet);.*(firefox)\/([\w\.-]+)/i
      ],
      [
        [
          NAME,
          `${PREFIX_MOBILE}${FIREFOX}`
        ],
        VERSION
      ]
    ],
    [
      [
        /(navigator|netscape\d?)\/([-\w\.]+)/i
      ],
      [
        [
          NAME,
          "Netscape"
        ],
        VERSION
      ]
    ],
    [
      [
        /mobile vr; rv:([\w\.]+)\).+firefox/i
      ],
      [
        VERSION,
        [
          NAME,
          `${FIREFOX} Reality`
        ]
      ]
    ],
    [
      [
        /ekiohf.+(flow)\/([\w\.]+)/i,
        /(swiftfox)/i,
        /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i,
        // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror/Klar
        /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i,
        // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
        /(firefox)\/([\w\.]+)/i,
        /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i,
        // Other
        /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i,
        // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir/Obigo/Mosaic/Go/ICE/UP.Browser
        /(links) \(([\w\.]+)/i,
        /panasonic;(viera)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(cobalt)\/([\w\.]+)/i
      ],
      [
        NAME,
        [
          VERSION,
          /[^\d\.]+./,
          EMPTY
        ]
      ]
    ]
  ],
  cpu: [
    [
      [
        /\b(?:(amd|x|x86[-_]?|wow|win)64)\b/i
      ],
      [
        [
          ARCHITECTURE,
          "amd64"
        ]
      ]
    ],
    [
      [
        /(ia32(?=;))/i,
        /((?:i[346]|x)86)[;\)]/i
      ],
      [
        [
          ARCHITECTURE,
          "ia32"
        ]
      ]
    ],
    [
      [
        /\b(aarch64|arm(v?8e?l?|_?64))\b/i
      ],
      [
        [
          ARCHITECTURE,
          "arm64"
        ]
      ]
    ],
    [
      [
        /windows (ce|mobile); ppc;/i
      ],
      [
        [
          ARCHITECTURE,
          "arm"
        ]
      ]
    ],
    [
      [
        /((?:ppc|powerpc)(?:64)?)(?: mac|;|\))/i
      ],
      [
        [
          ARCHITECTURE,
          /ower/,
          EMPTY,
          lowerize
        ]
      ]
    ],
    [
      [
        /(sun4\w)[;\)]/i
      ],
      [
        [
          ARCHITECTURE,
          "sparc"
        ]
      ]
    ],
    [
      [
        /((?:avr32|ia64(?=;))|68k(?=\))|\barm(?=v(?:[1-7]|[5-7]1)l?|;|eabi)|(?=atmel )avr|(?:irix|mips|sparc)(?:64)?\b|pa-risc)/i
      ],
      [
        [
          ARCHITECTURE,
          lowerize
        ]
      ]
    ]
  ],
  device: [
    [
      [
        /\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SAMSUNG
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /\b((?:s[cgp]h|gt|sm)-\w+|sc[g-]?[\d]+a?|galaxy nexus)/i,
        /samsung[- ]([-\w]+)/i,
        /sec-(sgh\w+)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SAMSUNG
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(?:\/|\()(ip(?:hone|od)[\w, ]*)(?:\/|;)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          APPLE
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\((ipad);[-\w\),; ]+apple/i,
        /applecoremedia\/[\w\.]+ \((ipad)/i,
        /\b(ipad)\d\d?,\d\d?[;\]].+ios/i
      ],
      [
        MODEL,
        [
          VENDOR,
          APPLE
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(macintosh);/i
      ],
      [
        MODEL,
        [
          VENDOR,
          APPLE
        ]
      ]
    ],
    [
      [
        /\b(sh-?[altvz]?\d\d[a-ekm]?)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SHARP
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b((?:ag[rs][23]?|bah2?|sht?|btv)-a?[lw]\d{2})\b(?!.+d\/s)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          HUAWEI
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(?:huawei|honor)([-\w ]+)[;\)]/i,
        /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          HUAWEI
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b(poco[\w ]+|m2\d{3}j\d\d[a-z]{2})(?: bui|\))/i,
        /\b; (\w+) build\/hm\1/i,
        /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i,
        /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i,
        /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite)?)(?: bui|\))/i
      ],
      [
        [
          MODEL,
          /_/g,
          " "
        ],
        [
          VENDOR,
          XIAOMI
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b(mi[-_ ]?(?:pad)(?:[\w_ ]+))(?: bui|\))/i
      ],
      [
        [
          MODEL,
          /_/g,
          " "
        ],
        [
          VENDOR,
          XIAOMI
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /; (\w+) bui.+ oppo/i,
        /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "OPPO"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /vivo (\w+)(?: bui|\))/i,
        /\b(v[12]\d{3}\w?[at])(?: bui|;)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Vivo"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b(rmx[12]\d{3})(?: bui|;|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Realme"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i,
        /\bmot(?:orola)?[- ](\w*)/i,
        /((?:moto[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          MOTOROLA
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /\b(mz60\d|xoom[2 ]{0,2}) build\//i
      ],
      [
        MODEL,
        [
          VENDOR,
          MOTOROLA
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i
      ],
      [
        MODEL,
        [
          VENDOR,
          LG
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i,
        /\blg[-e;\/ ]+((?!browser|netcast|android tv)\w+)/i,
        /\blg-?([\d\w]+) bui/i
      ],
      [
        MODEL,
        [
          VENDOR,
          LG
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(ideatab[-\w ]+)/i,
        /lenovo ?(s[56]000[-\w]+|tab(?:[\w ]+)|yt[-\d\w]{6}|tb[-\d\w]{6})/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Lenovo"
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(?:maemo|nokia).*(n900|lumia \d+)/i,
        /nokia[-_ ]?([-\w\.]*)/i
      ],
      [
        [
          MODEL,
          /_/g,
          " "
        ],
        [
          VENDOR,
          "Nokia"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(pixel c)\b/i
      ],
      [
        MODEL,
        [
          VENDOR,
          GOOGLE
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          GOOGLE
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /droid.+ (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SONY
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /sony tablet [ps]/i,
        /\b(?:sony)?sgp\w+(?: bui|\))/i
      ],
      [
        [
          MODEL,
          "Xperia Tablet"
        ],
        [
          VENDOR,
          SONY
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        / (kb2005|in20[12]5|be20[12][59])\b/i,
        /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "OnePlus"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(alexa)webm/i,
        /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i,
        /(kf[a-z]+)( bui|\)).+silk\//i
      ],
      [
        MODEL,
        [
          VENDOR,
          AMAZON
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i
      ],
      [
        [
          MODEL,
          /(.+)/g,
          "Fire Phone $1"
        ],
        [
          VENDOR,
          AMAZON
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(playbook);[-\w\),; ]+(rim)/i
      ],
      [
        MODEL,
        VENDOR,
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /\b((?:bb[a-f]|st[hv])100-\d)/i,
        /\(bb10; (\w+)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          BLACKBERRY
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i
      ],
      [
        MODEL,
        [
          VENDOR,
          ASUS
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        / (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i
      ],
      [
        MODEL,
        [
          VENDOR,
          ASUS
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(nexus 9)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "HTC"
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i,
        /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i,
        /(alcatel|geeksphone|nexian|panasonic(?!(?:;|\.))|sony(?!-bra))[-_ ]?([-\w]*)/i
      ],
      [
        VENDOR,
        [
          MODEL,
          /_/g,
          " "
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /droid.+; ([ab][1-7]-?[0178a]\d\d?)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Acer"
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /droid.+; (m[1-5] note) bui/i,
        /\bmz-([-\w]{2,})/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Meizu"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron|infinix|tecno)[-_ ]?([-\w]*)/i,
        // BlackBerry/BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Meizu/Motorola/Polytron
        /(hp) ([\w ]+\w)/i,
        /(asus)-?(\w+)/i,
        /(microsoft); (lumia[\w ]+)/i,
        /(lenovo)[-_ ]?([-\w]+)/i,
        /(jolla)/i,
        /(oppo) ?([\w ]+) bui/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(kobo)\s(ereader|touch)/i,
        /(archos) (gamepad2?)/i,
        /(hp).+(touchpad(?!.+tablet)|tablet)/i,
        /(kindle)\/([\w\.]+)/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(surface duo)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          MICROSOFT
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /droid [\d\.]+; (fp\du?)(?: b|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Fairphone"
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(shield[\w ]+) b/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Nvidia"
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(sprint) (\w+)/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(kin\.[onetw]{3})/i
      ],
      [
        [
          MODEL,
          /\./g,
          " "
        ],
        [
          VENDOR,
          MICROSOFT
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /droid.+; ([c6]+|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          ZEBRA
        ],
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          ZEBRA
        ],
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /smart-tv.+(samsung)/i
      ],
      [
        VENDOR,
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /hbbtv.+maple;(\d+)/i
      ],
      [
        [
          MODEL,
          /^/,
          "SmartTV"
        ],
        [
          VENDOR,
          SAMSUNG
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i
      ],
      [
        [
          VENDOR,
          LG
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /(apple) ?tv/i
      ],
      [
        VENDOR,
        [
          MODEL,
          `${APPLE} TV`
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /crkey/i
      ],
      [
        [
          MODEL,
          `${CHROME}cast`
        ],
        [
          VENDOR,
          GOOGLE
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /droid.+aft(\w)( bui|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          AMAZON
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /\(dtv[\);].+(aquos)/i,
        /(aquos-tv[\w ]+)\)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SHARP
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /(bravia[\w ]+)( bui|\))/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SONY
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /(mitv-\w{5}) bui/i
      ],
      [
        MODEL,
        [
          VENDOR,
          XIAOMI
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /Hbbtv.*(technisat) (.*);/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i,
        /hbbtv\/\d+\.\d+\.\d+ +\([\w\+ ]*; *([\w\d][^;]*);([^;]*)/i
      ],
      [
        [
          VENDOR,
          trim
        ],
        [
          MODEL,
          trim
        ],
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i
      ],
      [
        [
          TYPE,
          SMARTTV
        ]
      ]
    ],
    [
      [
        /(ouya)/i,
        /(nintendo) (\w+)/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          CONSOLE
        ]
      ]
    ],
    [
      [
        /droid.+; (shield) bui/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Nvidia"
        ],
        [
          TYPE,
          CONSOLE
        ]
      ]
    ],
    [
      [
        /(playstation \w+)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          SONY
        ],
        [
          TYPE,
          CONSOLE
        ]
      ]
    ],
    [
      [
        /\b(xbox(?: one)?(?!; xbox))[\); ]/i
      ],
      [
        MODEL,
        [
          VENDOR,
          MICROSOFT
        ],
        [
          TYPE,
          CONSOLE
        ]
      ]
    ],
    [
      [
        /((pebble))app/i
      ],
      [
        VENDOR,
        MODEL,
        [
          TYPE,
          WEARABLE
        ]
      ]
    ],
    [
      [
        /(watch)(?: ?os[,\/]|\d,\d\/)[\d\.]+/i
      ],
      [
        MODEL,
        [
          VENDOR,
          APPLE
        ],
        [
          TYPE,
          WEARABLE
        ]
      ]
    ],
    [
      [
        /droid.+; (glass) \d/i
      ],
      [
        MODEL,
        [
          VENDOR,
          GOOGLE
        ],
        [
          TYPE,
          WEARABLE
        ]
      ]
    ],
    [
      [
        /droid.+; (wt63?0{2,3})\)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          ZEBRA
        ],
        [
          TYPE,
          WEARABLE
        ]
      ]
    ],
    [
      [
        /(quest( 2| pro)?)/i
      ],
      [
        MODEL,
        [
          VENDOR,
          FACEBOOK
        ],
        [
          TYPE,
          WEARABLE
        ]
      ]
    ],
    [
      [
        /(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i
      ],
      [
        VENDOR,
        [
          TYPE,
          EMBEDDED
        ]
      ]
    ],
    [
      [
        /(aeobc)\b/i
      ],
      [
        MODEL,
        [
          VENDOR,
          AMAZON
        ],
        [
          TYPE,
          EMBEDDED
        ]
      ]
    ],
    [
      [
        /droid .+?; ([^;]+?)(?: bui|\) applew).+? mobile safari/i
      ],
      [
        MODEL,
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /droid .+?; ([^;]+?)(?: bui|\) applew).+?(?! mobile) safari/i
      ],
      [
        MODEL,
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i
      ],
      [
        [
          TYPE,
          TABLET
        ]
      ]
    ],
    [
      [
        /(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i
      ],
      [
        [
          TYPE,
          MOBILE
        ]
      ]
    ],
    [
      [
        /(android[-\w\. ]{0,9});.+buil/i
      ],
      [
        MODEL,
        [
          VENDOR,
          "Generic"
        ]
      ]
    ]
  ],
  engine: [
    [
      [
        /windows.+ edge\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${EDGE}HTML`
        ]
      ]
    ],
    [
      [
        /webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Blink"
        ]
      ]
    ],
    [
      [
        /(presto)\/([\w\.]+)/i,
        /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i,
        /ekioh(flow)\/([\w\.]+)/i,
        /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i,
        /(icab)[\/ ]([23]\.[\d\.]+)/i,
        /\b(libweb)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /rv\:([\w\.]{1,9})\b.+(gecko)/i
      ],
      [
        VERSION,
        NAME
      ]
    ]
  ],
  os: [
    [
      [
        /microsoft (windows) (vista|xp)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(windows) nt 6\.2; (arm)/i,
        /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i,
        /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i
      ],
      [
        NAME,
        [
          VERSION,
          mapWinVer
        ]
      ]
    ],
    [
      [
        /(win(?=3|9|n)|win 9x )([nt\d\.]+)/i
      ],
      [
        [
          NAME,
          WINDOWS
        ],
        [
          VERSION,
          mapWinVer
        ]
      ]
    ],
    [
      [
        /ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i,
        /(?:ios;fbsv\/|iphone.+ios[\/ ])([\d\.]+)/i,
        /cfnetwork\/.+darwin/i
      ],
      [
        [
          VERSION,
          /_/g,
          "."
        ],
        [
          NAME,
          "iOS"
        ]
      ]
    ],
    [
      [
        /(mac os x) ?([\w\. ]*)/i,
        /(macintosh|mac_powerpc\b)(?!.+haiku)/i
      ],
      [
        [
          NAME,
          "macOS"
        ],
        [
          VERSION,
          /_/g,
          "."
        ]
      ]
    ],
    [
      [
        /droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i
      ],
      [
        VERSION,
        NAME
      ]
    ],
    [
      [
        /(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i,
        /(blackberry)\w*\/([\w\.]*)/i,
        /(tizen|kaios)[\/ ]([\w\.]+)/i,
        /\((series40);/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /\(bb(10);/i
      ],
      [
        VERSION,
        [
          NAME,
          BLACKBERRY
        ]
      ]
    ],
    [
      [
        /(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i
      ],
      [
        VERSION,
        [
          NAME,
          "Symbian"
        ]
      ]
    ],
    [
      [
        /mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${FIREFOX} OS`
        ]
      ]
    ],
    [
      [
        /web0s;.+rt(tv)/i,
        /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "webOS"
        ]
      ]
    ],
    [
      [
        /watch(?: ?os[,\/]|\d,\d\/)([\d\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          "watchOS"
        ]
      ]
    ],
    [
      [
        /crkey\/([\d\.]+)/i
      ],
      [
        VERSION,
        [
          NAME,
          `${CHROME}cast`
        ]
      ]
    ],
    [
      [
        /(cros) [\w]+(?:\)| ([\w\.]+)\b)/i
      ],
      [
        [
          NAME,
          "Chrome OS"
        ],
        VERSION
      ]
    ],
    [
      [
        /panasonic;(viera)/i,
        /(netrange)mmh/i,
        /(nettv)\/(\d+\.[\w\.]+)/i,
        // Console
        /(nintendo|playstation) (\w+)/i,
        /(xbox); +xbox ([^\);]+)/i,
        // Other
        /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i,
        /(mint)[\/\(\) ]?(\w*)/i,
        /(mageia|vectorlinux)[; ]/i,
        /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i,
        // Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware/Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus/Raspbian/Plan9/Minix/RISCOS/Contiki/Deepin/Manjaro/elementary/Sabayon/Linspire
        /(hurd|linux) ?([\w\.]*)/i,
        /(gnu) ?([\w\.]*)/i,
        /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i,
        /(haiku) (\w+)/i
      ],
      [
        NAME,
        VERSION
      ]
    ],
    [
      [
        /(sunos) ?([\w\.\d]*)/i
      ],
      [
        [
          NAME,
          "Solaris"
        ],
        VERSION
      ]
    ],
    [
      [
        /((?:open)?solaris)[-\/ ]?([\w\.]*)/i,
        /(aix) ((\d)(?=\.|\)| )[\w\.])*/i,
        /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux|serenityos)/i,
        /(unix) ?([\w\.]*)/i
      ],
      [
        NAME,
        VERSION
      ]
    ]
  ]
};
export class UserAgent {
  #browser;
  #cpu;
  #device;
  #engine;
  #os;
  #ua;
  /** A representation of user agent string, which can be used to determine
   * environmental information represented by the string. All properties are
   * determined lazily.
   *
   * ```ts
   * import { UserAgent } from "https://deno.land/std@$STD_VERSION/http/user_agent.ts";
   *
   * Deno.serve((req) => {
   *   const userAgent = new UserAgent(req.headers.get("user-agent") ?? "");
   *   return new Response(`Hello, ${userAgent.browser.name}
   *     on ${userAgent.os.name} ${userAgent.os.version}!`);
   * });
   * ```
   */ constructor(ua){
    this.#ua = ua ?? "";
  }
  /** The name and version of the browser extracted from the user agent
   * string. */ get browser() {
    if (!this.#browser) {
      this.#browser = {
        name: undefined,
        version: undefined,
        major: undefined
      };
      mapper(this.#browser, this.#ua, matchers.browser);
      // deno-lint-ignore no-explicit-any
      this.#browser.major = majorize(this.#browser.version);
      Object.freeze(this.#browser);
    }
    return this.#browser;
  }
  /** The architecture of the CPU extracted from the user agent string. */ get cpu() {
    if (!this.#cpu) {
      this.#cpu = {
        architecture: undefined
      };
      mapper(this.#cpu, this.#ua, matchers.cpu);
      Object.freeze(this.#cpu);
    }
    return this.#cpu;
  }
  /** The model, type, and vendor of a device if present in a user agent
   * string. */ get device() {
    if (!this.#device) {
      this.#device = {
        model: undefined,
        type: undefined,
        vendor: undefined
      };
      mapper(this.#device, this.#ua, matchers.device);
      Object.freeze(this.#device);
    }
    return this.#device;
  }
  /** The name and version of the browser engine in a user agent string. */ get engine() {
    if (!this.#engine) {
      this.#engine = {
        name: undefined,
        version: undefined
      };
      mapper(this.#engine, this.#ua, matchers.engine);
      Object.freeze(this.#engine);
    }
    return this.#engine;
  }
  /** The name and version of the operating system in a user agent string. */ get os() {
    if (!this.#os) {
      this.#os = {
        name: undefined,
        version: undefined
      };
      mapper(this.#os, this.#ua, matchers.os);
      Object.freeze(this.#os);
    }
    return this.#os;
  }
  /** A read only version of the user agent string related to the instance. */ get ua() {
    return this.#ua;
  }
  toJSON() {
    const { browser, cpu, device, engine, os, ua } = this;
    return {
      browser,
      cpu,
      device,
      engine,
      os,
      ua
    };
  }
  toString() {
    return this.#ua;
  }
  [Symbol.for("Deno.customInspect")](inspect) {
    const { browser, cpu, device, engine, os, ua } = this;
    return `${this.constructor.name} ${inspect({
      browser,
      cpu,
      device,
      engine,
      os,
      ua
    })}`;
  }
  [Symbol.for("nodejs.util.inspect.custom")](depth, // deno-lint-ignore no-explicit-any
  options, inspect) {
    if (depth < 0) {
      return options.stylize(`[${this.constructor.name}]`, "special");
    }
    const newOptions = Object.assign({}, options, {
      depth: options.depth === null ? null : options.depth - 1
    });
    const { browser, cpu, device, engine, os, ua } = this;
    return `${options.stylize(this.constructor.name, "special")} ${inspect({
      browser,
      cpu,
      device,
      engine,
      os,
      ua
    }, newOptions)}`;
  }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjIwMC4wL2h0dHAvdXNlcl9hZ2VudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIzIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLy8gVGhpcyBtb2R1bGUgaXMgYnJvd3NlciBjb21wYXRpYmxlLlxuXG4vLyBUaGlzIG1vZHVsZSB3YXMgaGVhdmlseSBpbnNwaXJlZCBieSB1YS1wYXJzZXItanNcbi8vIChodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS91YS1wYXJzZXItanMpIHdoaWNoIGlzIE1JVCBsaWNlbnNlZCBhbmRcbi8vIENvcHlyaWdodCAoYykgMjAxMi0yMDIzIEZhaXNhbCBTYWxtYW4gPGZAZmFpc2FsbWFuLmNvbT5cblxuLyoqIFByb3ZpZGVzIHtAbGlua2NvZGUgVXNlckFnZW50fSBhbmQgcmVsYXRlZCB0eXBlcyB0byBiZSBhYmxlIHRvIHByb3ZpZGUgYVxuICogc3RydWN0dXJlZCB1bmRlcnN0YW5kaW5nIG9mIGEgdXNlciBhZ2VudCBzdHJpbmcuXG4gKlxuICogQG1vZHVsZVxuICovXG5cbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi9hc3NlcnQvYXNzZXJ0LnRzXCI7XG5cbmNvbnN0IEFSQ0hJVEVDVFVSRSA9IFwiYXJjaGl0ZWN0dXJlXCI7XG5jb25zdCBNT0RFTCA9IFwibW9kZWxcIjtcbmNvbnN0IE5BTUUgPSBcIm5hbWVcIjtcbmNvbnN0IFRZUEUgPSBcInR5cGVcIjtcbmNvbnN0IFZFTkRPUiA9IFwidmVuZG9yXCI7XG5jb25zdCBWRVJTSU9OID0gXCJ2ZXJzaW9uXCI7XG5jb25zdCBFTVBUWSA9IFwiXCI7XG5cbmNvbnN0IENPTlNPTEUgPSBcImNvbnNvbGVcIjtcbmNvbnN0IEVNQkVEREVEID0gXCJlbWJlZGRlZFwiO1xuY29uc3QgTU9CSUxFID0gXCJtb2JpbGVcIjtcbmNvbnN0IFRBQkxFVCA9IFwidGFibGV0XCI7XG5jb25zdCBTTUFSVFRWID0gXCJzbWFydHR2XCI7XG5jb25zdCBXRUFSQUJMRSA9IFwid2VhcmFibGVcIjtcblxuY29uc3QgUFJFRklYX01PQklMRSA9IFwiTW9iaWxlIFwiO1xuY29uc3QgU1VGRklYX0JST1dTRVIgPSBcIiBCcm93c2VyXCI7XG5cbmNvbnN0IEFNQVpPTiA9IFwiQW1hem9uXCI7XG5jb25zdCBBUFBMRSA9IFwiQXBwbGVcIjtcbmNvbnN0IEFTVVMgPSBcIkFTVVNcIjtcbmNvbnN0IEJMQUNLQkVSUlkgPSBcIkJsYWNrQmVycnlcIjtcbmNvbnN0IENIUk9NRSA9IFwiQ2hyb21lXCI7XG5jb25zdCBFREdFID0gXCJFZGdlXCI7XG5jb25zdCBGQUNFQk9PSyA9IFwiRmFjZWJvb2tcIjtcbmNvbnN0IEZJUkVGT1ggPSBcIkZpcmVmb3hcIjtcbmNvbnN0IEdPT0dMRSA9IFwiR29vZ2xlXCI7XG5jb25zdCBIVUFXRUkgPSBcIkh1YXdlaVwiO1xuY29uc3QgTEcgPSBcIkxHXCI7XG5jb25zdCBNSUNST1NPRlQgPSBcIk1pY3Jvc29mdFwiO1xuY29uc3QgTU9UT1JPTEEgPSBcIk1vdG9yb2xhXCI7XG5jb25zdCBPUEVSQSA9IFwiT3BlcmFcIjtcbmNvbnN0IFNBTVNVTkcgPSBcIlNhbXN1bmdcIjtcbmNvbnN0IFNIQVJQID0gXCJTaGFycFwiO1xuY29uc3QgU09OWSA9IFwiU29ueVwiO1xuY29uc3QgV0lORE9XUyA9IFwiV2luZG93c1wiO1xuY29uc3QgWElBT01JID0gXCJYaWFvbWlcIjtcbmNvbnN0IFpFQlJBID0gXCJaZWJyYVwiO1xuXG50eXBlIFByb2Nlc3NpbmdGbiA9ICh2YWx1ZTogc3RyaW5nKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbnR5cGUgTWF0Y2hpbmdUdXBsZSA9IFttYXRjaGVyczogW1JlZ0V4cCwgLi4uUmVnRXhwW11dLCBwcm9jZXNzb3JzOiAoXG4gIHN0cmluZyB8IFtzdHJpbmcsIHN0cmluZ10gfCBbc3RyaW5nLCBQcm9jZXNzaW5nRm5dIHwgW1xuICAgIHN0cmluZyxcbiAgICBSZWdFeHAsXG4gICAgc3RyaW5nLFxuICAgIFByb2Nlc3NpbmdGbj8sXG4gIF1cbilbXV07XG5cbmludGVyZmFjZSBNYXRjaGVycyB7XG4gIGJyb3dzZXI6IE1hdGNoaW5nVHVwbGVbXTtcbiAgY3B1OiBNYXRjaGluZ1R1cGxlW107XG4gIGRldmljZTogTWF0Y2hpbmdUdXBsZVtdO1xuICBlbmdpbmU6IE1hdGNoaW5nVHVwbGVbXTtcbiAgb3M6IE1hdGNoaW5nVHVwbGVbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCcm93c2VyIHtcbiAgLyoqIFRoZSBtYWpvciB2ZXJzaW9uIG9mIGEgYnJvd3NlciBhcyByZXByZXNlbnRlZCBieSBhIHVzZXIgYWdlbnQgc3RyaW5nLiAqL1xuICByZWFkb25seSBtYWpvcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAvKiogVGhlIG5hbWUgb2YgYSBicm93c2VyIGFzIHJlcHJlc2VudGVkIGJ5IGEgdXNlciBhZ2VudCBzdHJpbmcuICovXG4gIHJlYWRvbmx5IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgLyoqIFRoZSB2ZXJzaW9uIG9mIGEgYnJvd3NlciBhcyByZXByZXNlbnRlZCBieSBhIHVzZXIgYWdlbnQgc3RyaW5nLiAqL1xuICByZWFkb25seSB2ZXJzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGV2aWNlIHtcbiAgLyoqIFRoZSBtb2RlbCBvZiBhIGRldmljZSBhcyByZXByZXNlbnRlZCBieSBhIHVzZXIgYWdlbnQgc3RyaW5nLiAqL1xuICByZWFkb25seSBtb2RlbDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAvKiogVGhlIHR5cGUgb2YgZGV2aWNlIGFzIHJlcHJlc2VudGVkIGJ5IGEgdXNlciBhZ2VudCBzdHJpbmcuICovXG4gIHJlYWRvbmx5IHR5cGU6XG4gICAgfCBcImNvbnNvbGVcIlxuICAgIHwgXCJtb2JpbGVcIlxuICAgIHwgXCJ0YWJsZVwiXG4gICAgfCBcInNtYXJ0dlwiXG4gICAgfCBcIndlYXJhYmxlXCJcbiAgICB8IFwiZW1iZWRkZWRcIlxuICAgIHwgdW5kZWZpbmVkO1xuICAvKiogVGhlIHZlbmRvciBvZiBhIGRldmljZSBhcyByZXByZXNlbnRlZCBieSBhIHVzZXIgYWdlbnQgc3RyaW5nLiAqL1xuICByZWFkb25seSB2ZW5kb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFbmdpbmUge1xuICByZWFkb25seSBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIHJlYWRvbmx5IHZlcnNpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPcyB7XG4gIHJlYWRvbmx5IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgcmVhZG9ubHkgdmVyc2lvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENwdSB7XG4gIHJlYWRvbmx5IGFyY2hpdGVjdHVyZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBsb3dlcml6ZShzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIudG9Mb3dlckNhc2UoKTtcbn1cblxuZnVuY3Rpb24gbWFqb3JpemUoc3RyOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gc3RyID8gc3RyLnJlcGxhY2UoL1teXFxkXFwuXS9nLCBFTVBUWSkuc3BsaXQoXCIuXCIpWzBdIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiB0cmltKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci50cmltU3RhcnQoKTtcbn1cblxuLyoqIEEgbWFwIHdoZXJlIHRoZSBrZXkgaXMgdGhlIGNvbW1vbiBXaW5kb3dzIHZlcnNpb24gYW5kIHRoZSB2YWx1ZSBpcyBhIHN0cmluZ1xuICogb3IgYXJyYXkgb2Ygc3RyaW5ncyBvZiBwb3RlbnRpYWwgdmFsdWVzIHBhcnNlZCBmcm9tIHRoZSB1c2VyLWFnZW50IHN0cmluZy4gKi9cbmNvbnN0IHdpbmRvd3NWZXJzaW9uTWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdPihbXG4gIFtcIk1FXCIsIFwiNC45MFwiXSxcbiAgW1wiTlQgMy4xMVwiLCBcIk5UMy41MVwiXSxcbiAgW1wiTlQgNC4wXCIsIFwiTlQ0LjBcIl0sXG4gIFtcIjIwMDBcIiwgXCJOVCA1LjBcIl0sXG4gIFtcIlhQXCIsIFtcIk5UIDUuMVwiLCBcIk5UIDUuMlwiXV0sXG4gIFtcIlZpc3RhXCIsIFwiTlQgNi4wXCJdLFxuICBbXCI3XCIsIFwiTlQgNi4xXCJdLFxuICBbXCI4XCIsIFwiTlQgNi4yXCJdLFxuICBbXCI4LjFcIiwgXCJOVCA2LjNcIl0sXG4gIFtcIjEwXCIsIFtcIk5UIDYuNFwiLCBcIk5UIDEwLjBcIl1dLFxuICBbXCJSVFwiLCBcIkFSTVwiXSxcbl0pO1xuXG5mdW5jdGlvbiBoYXMoc3RyMTogc3RyaW5nIHwgc3RyaW5nW10sIHN0cjI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoQXJyYXkuaXNBcnJheShzdHIxKSkge1xuICAgIGZvciAoY29uc3QgZWwgb2Ygc3RyMSkge1xuICAgICAgaWYgKGxvd2VyaXplKGVsKSA9PT0gbG93ZXJpemUoc3RyMikpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gbG93ZXJpemUoc3RyMikuaW5kZXhPZihsb3dlcml6ZShzdHIxKSkgIT09IC0xO1xufVxuXG5mdW5jdGlvbiBtYXBXaW5WZXIoc3RyOiBzdHJpbmcpIHtcbiAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2Ygd2luZG93c1ZlcnNpb25NYXApIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIGZvciAoY29uc3QgdiBvZiB2YWx1ZSkge1xuICAgICAgICBpZiAoaGFzKHYsIHN0cikpIHtcbiAgICAgICAgICByZXR1cm4ga2V5O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChoYXModmFsdWUsIHN0cikpIHtcbiAgICAgIHJldHVybiBrZXk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHIgfHwgdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBtYXBwZXIoXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHRhcmdldDogYW55LFxuICB1YTogc3RyaW5nLFxuICB0dXBsZXM6IE1hdGNoaW5nVHVwbGVbXSxcbik6IHZvaWQge1xuICBsZXQgbWF0Y2hlczogUmVnRXhwRXhlY0FycmF5IHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgW21hdGNoZXJzLCBwcm9jZXNzb3JzXSBvZiB0dXBsZXMpIHtcbiAgICBsZXQgaiA9IDA7XG4gICAgbGV0IGsgPSAwO1xuICAgIHdoaWxlIChqIDwgbWF0Y2hlcnMubGVuZ3RoICYmICFtYXRjaGVzKSB7XG4gICAgICBpZiAoIW1hdGNoZXJzW2pdKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgbWF0Y2hlcyA9IG1hdGNoZXJzW2orK10uZXhlYyh1YSk7XG5cbiAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgIGZvciAoY29uc3QgcHJvY2Vzc29yIG9mIHByb2Nlc3NvcnMpIHtcbiAgICAgICAgICBjb25zdCBtYXRjaCA9IG1hdGNoZXNbKytrXTtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9jZXNzb3IpKSB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzc29yLmxlbmd0aCA9PT0gMikge1xuICAgICAgICAgICAgICBjb25zdCBbcHJvcCwgdmFsdWVdID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSB2YWx1ZS5jYWxsKFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgICAgICAgICAgbWF0Y2gsXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9jZXNzb3IubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICAgIGNvbnN0IFtwcm9wLCByZSwgdmFsdWVdID0gcHJvY2Vzc29yO1xuICAgICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBtYXRjaCA/IG1hdGNoLnJlcGxhY2UocmUsIHZhbHVlKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnN0IFtwcm9wLCByZSwgdmFsdWUsIGZuXSA9IHByb2Nlc3NvcjtcbiAgICAgICAgICAgICAgYXNzZXJ0KGZuKTtcbiAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0gbWF0Y2hcbiAgICAgICAgICAgICAgICA/IGZuLmNhbGwocHJvcCwgbWF0Y2gucmVwbGFjZShyZSwgdmFsdWUpKVxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXRbcHJvY2Vzc29yXSA9IG1hdGNoID8gbWF0Y2ggOiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKiBBbiBvYmplY3Qgd2l0aCBwcm9wZXJ0aWVzIHRoYXQgYXJlIGFycmF5cyBvZiB0dXBsZXMgd2hpY2ggcHJvdmlkZSBtYXRjaFxuICogcGF0dGVybnMgYW5kIGNvbmZpZ3VyYXRpb24gb24gaG93IHRvIGludGVycHJldCB0aGUgY2FwdHVyZSBncm91cHMuICovXG5jb25zdCBtYXRjaGVyczogTWF0Y2hlcnMgPSB7XG4gIGJyb3dzZXI6IFtcbiAgICBbXG4gICAgICBbL1xcYig/OmNybW98Y3Jpb3MpXFwvKFtcXHdcXC5dKykvaV0sIC8vIENocm9tZSBmb3IgQW5kcm9pZC9pT1NcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7UFJFRklYX01PQklMRX0ke0NIUk9NRX1gXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2VkZyg/OmV8aW9zfGEpP1xcLyhbXFx3XFwuXSspL2ldLCAvLyBNaWNyb3NvZnQgRWRnZVxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIkVkZ2VcIl1dLFxuICAgIF0sXG5cbiAgICAvLyBQcmVzdG8gYmFzZWRcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8ob3BlcmEgbWluaSlcXC8oWy1cXHdcXC5dKykvaSwgLy8gT3BlcmEgTWluaVxuICAgICAgICAvKG9wZXJhIFttb2JpbGV0YWJdezMsNn0pXFxiLit2ZXJzaW9uXFwvKFstXFx3XFwuXSspL2ksIC8vIE9wZXJhIE1vYmkvVGFibGV0XG4gICAgICAgIC8ob3BlcmEpKD86Lit2ZXJzaW9uXFwvfFtcXC8gXSspKFtcXHdcXC5dKykvaSwgLy8gT3BlcmFcbiAgICAgIF0sXG4gICAgICBbTkFNRSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL29waW9zW1xcLyBdKyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBgJHtPUEVSQX0gTWluaWBdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvXFxib3ByXFwvKFtcXHdcXC5dKykvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIE9QRVJBXV0sXG4gICAgXSxcblxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLy8gTWl4ZWRcbiAgICAgICAgLyhraW5kbGUpXFwvKFtcXHdcXC5dKykvaSwgLy8gS2luZGxlXG4gICAgICAgIC8obHVuYXNjYXBlfG1heHRob258bmV0ZnJvbnR8amFzbWluZXxibGF6ZXIpW1xcLyBdPyhbXFx3XFwuXSopL2ksIC8vIEx1bmFzY2FwZS9NYXh0aG9uL05ldGZyb250L0phc21pbmUvQmxhemVyXG4gICAgICAgIC8vIFRyaWRlbnQgYmFzZWRcbiAgICAgICAgLyhhdmFudCB8aWVtb2JpbGV8c2xpbSkoPzpicm93c2VyKT9bXFwvIF0/KFtcXHdcXC5dKikvaSwgLy8gQXZhbnQvSUVNb2JpbGUvU2xpbUJyb3dzZXJcbiAgICAgICAgLyhiYT9pZHVicm93c2VyKVtcXC8gXT8oW1xcd1xcLl0rKS9pLCAvLyBCYWlkdSBCcm93c2VyXG4gICAgICAgIC8oPzptc3xcXCgpKGllKSAoW1xcd1xcLl0rKS9pLCAvLyBJbnRlcm5ldCBFeHBsb3JlclxuXG4gICAgICAgIC8vIFdlYmtpdC9LSFRNTCBiYXNlZFxuICAgICAgICAvLyBGbG9jay9Sb2NrTWVsdC9NaWRvcmkvRXBpcGhhbnkvU2lsay9Ta3lmaXJlL0JvbHQvSXJvbi9JcmlkaXVtL1BoYW50b21KUy9Cb3dzZXIvUXVwWmlsbGEvRmFsa29uL1Jla29ucS9QdWZmaW4vQnJhdmUvV2hhbGUvUVFCcm93c2VyTGl0ZS9RUS8vVml2YWxkaS9EdWNrRHVja0dvXG4gICAgICAgIC8oZmxvY2t8cm9ja21lbHR8bWlkb3JpfGVwaXBoYW55fHNpbGt8c2t5ZmlyZXxvdmlicm93c2VyfGJvbHR8aXJvbnx2aXZhbGRpfGlyaWRpdW18cGhhbnRvbWpzfGJvd3NlcnxxdWFya3xxdXB6aWxsYXxmYWxrb258cmVrb25xfHB1ZmZpbnxicmF2ZXx3aGFsZSg/IS4rbmF2ZXIpfHFxYnJvd3NlcmxpdGV8cXF8ZHVja2R1Y2tnbylcXC8oWy1cXHdcXC5dKykvaSxcbiAgICAgICAgLyhoZXl0YXB8b3ZpKWJyb3dzZXJcXC8oW1xcZFxcLl0rKS9pLCAvLyBIZXlUYXAvT3ZpXG4gICAgICAgIC8od2VpYm8pX18oW1xcZFxcLl0rKS9pLCAvLyBXZWlib1xuICAgICAgXSxcbiAgICAgIFtOQU1FLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKD86XFxidWM/ID9icm93c2VyfCg/Omp1Yy4rKXVjd2ViKVtcXC8gXT8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgXCJVQ0Jyb3dzZXJcIl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvbWljcm9tLitcXGJxYmNvcmVcXC8oW1xcd1xcLl0rKS9pLCAvLyBXZUNoYXQgRGVza3RvcCBmb3IgV2luZG93cyBCdWlsdC1pbiBCcm93c2VyXG4gICAgICAgIC9cXGJxYmNvcmVcXC8oW1xcd1xcLl0rKS4rbWljcm9tL2ksXG4gICAgICBdLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIldlQ2hhdChXaW4pIERlc2t0b3BcIl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9taWNyb21lc3NlbmdlclxcLyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIldlQ2hhdFwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2tvbnF1ZXJvclxcLyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIktvbnF1ZXJvclwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL3RyaWRlbnQuK3J2WzogXShbXFx3XFwuXXsxLDl9KVxcYi4rbGlrZSBnZWNrby9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgXCJJRVwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL3lhKD86c2VhcmNoKT9icm93c2VyXFwvKFtcXHdcXC5dKykvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIFwiWWFuZGV4XCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKGF2YXN0fGF2ZylcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtbTkFNRSwgLyguKykvLCBgJDEgU2VjdXJlJHtTVUZGSVhfQlJPV1NFUn1gXSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYmZvY3VzXFwvKFtcXHdcXC5dKykvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIGAke0ZJUkVGT1h9IEZvY3VzYF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGJvcHRcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7T1BFUkF9IFRvdWNoYF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9jb2NfY29jXFx3K1xcLyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIkNvYyBDb2NcIl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kb2xmaW5cXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgXCJEb2xwaGluXCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvY29hc3RcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7T1BFUkF9IENvYXN0YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9taXVpYnJvd3NlclxcLyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBgTUlVSSR7U1VGRklYX0JST1dTRVJ9YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9meGlvc1xcLyhbXFx3XFwuLV0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7UFJFRklYX01PQklMRX0ke0ZJUkVGT1h9YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGJxaWh1fChxaT9obz9vP3wzNjApYnJvd3Nlci9pXSxcbiAgICAgIFtbTkFNRSwgYDM2MCR7U1VGRklYX0JST1dTRVJ9YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8ob2N1bHVzfHNhbXN1bmd8c2FpbGZpc2h8aHVhd2VpKWJyb3dzZXJcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtbTkFNRSwgLyguKykvLCBcIiQxXCIgKyBTVUZGSVhfQlJPV1NFUl0sIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oY29tb2RvX2RyYWdvbilcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtbTkFNRSwgL18vZywgXCIgXCJdLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhlbGVjdHJvbilcXC8oW1xcd1xcLl0rKSBzYWZhcmkvaSwgLy8gRWxlY3Ryb24tYmFzZWQgQXBwXG4gICAgICAgIC8odGVzbGEpKD86IHF0Y2FyYnJvd3NlcnxcXC8oMjBcXGRcXGRcXC5bLVxcd1xcLl0rKSkvaSwgLy8gVGVzbGFcbiAgICAgICAgL20/KHFxYnJvd3NlcnxiYWlkdWJveGFwcHwyMzQ1RXhwbG9yZXIpW1xcLyBdPyhbXFx3XFwuXSspL2ksXG4gICAgICBdLFxuICAgICAgW05BTUUsIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvKG1ldGFzcilbXFwvIF0/KFtcXHdcXC5dKykvaSwgLy8gU291R291QnJvd3NlclxuICAgICAgICAvKGxiYnJvd3NlcikvaSwgLy8gTGllQmFvIEJyb3dzZXJcbiAgICAgICAgL1xcWyhsaW5rZWRpbilhcHBcXF0vaSwgLy8gTGlua2VkSW4gQXBwIGZvciBpT1MgJiBBbmRyb2lkXG4gICAgICBdLFxuICAgICAgW05BTUVdLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oKD86ZmJhblxcL2ZiaW9zfGZiX2lhYlxcL2ZiNGEpKD8hLitmYmF2KXw7ZmJhdlxcLyhbXFx3XFwuXSspOykvaV0sXG4gICAgICBbW05BTUUsIEZBQ0VCT09LXSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8oa2FrYW8oPzp0YWxrfHN0b3J5KSlbXFwvIF0oW1xcd1xcLl0rKS9pLCAvLyBLYWthbyBBcHBcbiAgICAgICAgLyhuYXZlcilcXCguKj8oXFxkK1xcLltcXHdcXC5dKykuKlxcKS9pLCAvLyBOYXZlciBJbkFwcFxuICAgICAgICAvc2FmYXJpIChsaW5lKVxcLyhbXFx3XFwuXSspL2ksIC8vIExpbmUgQXBwIGZvciBpT1NcbiAgICAgICAgL1xcYihsaW5lKVxcLyhbXFx3XFwuXSspXFwvaWFiL2ksIC8vIExpbmUgQXBwIGZvciBBbmRyb2lkXG4gICAgICAgIC8oY2hyb21pdW18aW5zdGFncmFtKVtcXC8gXShbLVxcd1xcLl0rKS9pLCAvLyBDaHJvbWl1bS9JbnN0YWdyYW1cbiAgICAgIF0sXG4gICAgICBbTkFNRSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYmdzYVxcLyhbXFx3XFwuXSspIC4qc2FmYXJpXFwvL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIkdTQVwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL211c2ljYWxfbHkoPzouK2FwcF8/dmVyc2lvblxcL3xfKShbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBcIlRpa1Rva1wiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2hlYWRsZXNzY2hyb21lKD86XFwvKFtcXHdcXC5dKyl8ICkvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIGAke0NIUk9NRX0gSGVhZGxlc3NgXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyB3dlxcKS4rKGNocm9tZSlcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtbTkFNRSwgYCR7Q0hST01FfSBXZWJWaWV3YF0sIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZC4rIHZlcnNpb25cXC8oW1xcd1xcLl0rKVxcYi4rKD86bW9iaWxlIHNhZmFyaXxzYWZhcmkpL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBgQW5kcm9pZCR7U1VGRklYX0JST1dTRVJ9YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9jaHJvbWVcXC8oW1xcd1xcLl0rKSBtb2JpbGUvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIGAke1BSRUZJWF9NT0JJTEV9JHtDSFJPTUV9YF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oY2hyb21lfG9tbml3ZWJ8YXJvcmF8W3RpemVub2thXXs1fSA/YnJvd3NlcilcXC92PyhbXFx3XFwuXSspL2ldLFxuICAgICAgW05BTUUsIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy92ZXJzaW9uXFwvKFtcXHdcXC5cXCxdKykgLiptb2JpbGUoPzpcXC9cXHcrIHwgPylzYWZhcmkvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIGAke1BSRUZJWF9NT0JJTEV9U2FmYXJpYF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9pcGhvbmUgLiptb2JpbGUoPzpcXC9cXHcrIHwgPylzYWZhcmkvaV0sXG4gICAgICBbW05BTUUsIGAke1BSRUZJWF9NT0JJTEV9U2FmYXJpYF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy92ZXJzaW9uXFwvKFtcXHdcXC5cXCxdKykgLiooc2FmYXJpKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBOQU1FXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvd2Via2l0Lis/KG1vYmlsZSA/c2FmYXJpfHNhZmFyaSkoXFwvW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtOQU1FLCBbVkVSU0lPTiwgXCIxXCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHdlYmtpdHxraHRtbClcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtOQU1FLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKD86bW9iaWxlfHRhYmxldCk7LiooZmlyZWZveClcXC8oW1xcd1xcLi1dKykvaV0sXG4gICAgICBbW05BTUUsIGAke1BSRUZJWF9NT0JJTEV9JHtGSVJFRk9YfWBdLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKG5hdmlnYXRvcnxuZXRzY2FwZVxcZD8pXFwvKFstXFx3XFwuXSspL2ldLFxuICAgICAgW1tOQU1FLCBcIk5ldHNjYXBlXCJdLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvbW9iaWxlIHZyOyBydjooW1xcd1xcLl0rKVxcKS4rZmlyZWZveC9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7RklSRUZPWH0gUmVhbGl0eWBdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL2VraW9oZi4rKGZsb3cpXFwvKFtcXHdcXC5dKykvaSwgLy8gRmxvd1xuICAgICAgICAvKHN3aWZ0Zm94KS9pLCAvLyBTd2lmdGZveFxuICAgICAgICAvKGljZWRyYWdvbnxpY2V3ZWFzZWx8Y2FtaW5vfGNoaW1lcmF8ZmVubmVjfG1hZW1vIGJyb3dzZXJ8bWluaW1vfGNvbmtlcm9yfGtsYXIpW1xcLyBdPyhbXFx3XFwuXFwrXSspL2ksXG4gICAgICAgIC8vIEljZURyYWdvbi9JY2V3ZWFzZWwvQ2FtaW5vL0NoaW1lcmEvRmVubmVjL01hZW1vL01pbmltby9Db25rZXJvci9LbGFyXG4gICAgICAgIC8oc2VhbW9ua2V5fGstbWVsZW9ufGljZWNhdHxpY2VhcGV8ZmlyZWJpcmR8cGhvZW5peHxwYWxlbW9vbnxiYXNpbGlza3x3YXRlcmZveClcXC8oWy1cXHdcXC5dKykkL2ksXG4gICAgICAgIC8vIEZpcmVmb3gvU2VhTW9ua2V5L0stTWVsZW9uL0ljZUNhdC9JY2VBcGUvRmlyZWJpcmQvUGhvZW5peFxuICAgICAgICAvKGZpcmVmb3gpXFwvKFtcXHdcXC5dKykvaSwgLy8gT3RoZXIgRmlyZWZveC1iYXNlZFxuICAgICAgICAvKG1vemlsbGEpXFwvKFtcXHdcXC5dKykgLitydlxcOi4rZ2Vja29cXC9cXGQrL2ksIC8vIE1vemlsbGFcblxuICAgICAgICAvLyBPdGhlclxuICAgICAgICAvKHBvbGFyaXN8bHlueHxkaWxsb3xpY2FifGRvcmlzfGFtYXlhfHczbXxuZXRzdXJmfHNsZWlwbmlyfG9iaWdvfG1vc2FpY3woPzpnb3xpY2V8dXApW1xcLiBdP2Jyb3dzZXIpWy1cXC8gXT92PyhbXFx3XFwuXSspL2ksXG4gICAgICAgIC8vIFBvbGFyaXMvTHlueC9EaWxsby9pQ2FiL0RvcmlzL0FtYXlhL3czbS9OZXRTdXJmL1NsZWlwbmlyL09iaWdvL01vc2FpYy9Hby9JQ0UvVVAuQnJvd3NlclxuICAgICAgICAvKGxpbmtzKSBcXCgoW1xcd1xcLl0rKS9pLCAvLyBMaW5rc1xuICAgICAgICAvcGFuYXNvbmljOyh2aWVyYSkvaSxcbiAgICAgIF0sXG4gICAgICBbTkFNRSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhjb2JhbHQpXFwvKFtcXHdcXC5dKykvaV0sXG4gICAgICBbTkFNRSwgW1ZFUlNJT04sIC9bXlxcZFxcLl0rLi8sIEVNUFRZXV0sXG4gICAgXSxcbiAgXSxcbiAgY3B1OiBbXG4gICAgW1xuICAgICAgWy9cXGIoPzooYW1kfHh8eDg2Wy1fXT98d293fHdpbik2NClcXGIvaV0sXG4gICAgICBbW0FSQ0hJVEVDVFVSRSwgXCJhbWQ2NFwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8oaWEzMig/PTspKS9pLCAvLyBJQTMyIChxdWlja3RpbWUpXG4gICAgICAgIC8oKD86aVszNDZdfHgpODYpWztcXCldL2ksXG4gICAgICBdLFxuICAgICAgW1tBUkNISVRFQ1RVUkUsIFwiaWEzMlwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYihhYXJjaDY0fGFybSh2PzhlP2w/fF8/NjQpKVxcYi9pXSxcbiAgICAgIFtbQVJDSElURUNUVVJFLCBcImFybTY0XCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvd2luZG93cyAoY2V8bW9iaWxlKTsgcHBjOy9pXSxcbiAgICAgIFtbQVJDSElURUNUVVJFLCBcImFybVwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLygoPzpwcGN8cG93ZXJwYykoPzo2NCk/KSg/OiBtYWN8O3xcXCkpL2ldLFxuICAgICAgW1tBUkNISVRFQ1RVUkUsIC9vd2VyLywgRU1QVFksIGxvd2VyaXplXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhzdW40XFx3KVs7XFwpXS9pXSxcbiAgICAgIFtbQVJDSElURUNUVVJFLCBcInNwYXJjXCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKCg/OmF2cjMyfGlhNjQoPz07KSl8NjhrKD89XFwpKXxcXGJhcm0oPz12KD86WzEtN118WzUtN10xKWw/fDt8ZWFiaSl8KD89YXRtZWwgKWF2cnwoPzppcml4fG1pcHN8c3BhcmMpKD86NjQpP1xcYnxwYS1yaXNjKS9pXSxcbiAgICAgIFtbQVJDSElURUNUVVJFLCBsb3dlcml6ZV1dLFxuICAgIF0sXG4gIF0sXG4gIGRldmljZTogW1xuICAgIFtcbiAgICAgIFsvXFxiKHNjaC1pWzg5XTBcXGR8c2h3LW0zODBzfHNtLVtwdHhdXFx3ezIsNH18Z3QtW3BuXVxcZHsyLDR9fHNnaC10OFs1Nl05fG5leHVzIDEwKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgU0FNU1VOR10sIFtUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL1xcYigoPzpzW2NncF1ofGd0fHNtKS1cXHcrfHNjW2ctXT9bXFxkXSthP3xnYWxheHkgbmV4dXMpL2ksXG4gICAgICAgIC9zYW1zdW5nWy0gXShbLVxcd10rKS9pLFxuICAgICAgICAvc2VjLShzZ2hcXHcrKS9pLFxuICAgICAgXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgU0FNU1VOR10sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKD86XFwvfFxcKCkoaXAoPzpob25lfG9kKVtcXHcsIF0qKSg/OlxcL3w7KS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgQVBQTEVdLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC9cXCgoaXBhZCk7Wy1cXHdcXCksOyBdK2FwcGxlL2ksIC8vIGlQYWRcbiAgICAgICAgL2FwcGxlY29yZW1lZGlhXFwvW1xcd1xcLl0rIFxcKChpcGFkKS9pLFxuICAgICAgICAvXFxiKGlwYWQpXFxkXFxkPyxcXGRcXGQ/WztcXF1dLitpb3MvaSxcbiAgICAgIF0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEFQUExFXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8obWFjaW50b3NoKTsvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEFQUExFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYihzaC0/W2FsdHZ6XT9cXGRcXGRbYS1la21dPykvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFNIQVJQXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGIoKD86YWdbcnNdWzIzXT98YmFoMj98c2h0P3xidHYpLWE/W2x3XVxcZHsyfSlcXGIoPyEuK2RcXC9zKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgSFVBV0VJXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvKD86aHVhd2VpfGhvbm9yKShbLVxcdyBdKylbO1xcKV0vaSxcbiAgICAgICAgL1xcYihuZXh1cyA2cHxcXHd7Miw0fWU/LVthdHVdP1tsbl1bXFxkeF1bMDEyMzU5Y11bYWRuXT8pXFxiKD8hLitkXFwvcykvaSxcbiAgICAgIF0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEhVQVdFSV0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL1xcYihwb2NvW1xcdyBdK3xtMlxcZHszfWpcXGRcXGRbYS16XXsyfSkoPzogYnVpfFxcKSkvaSwgLy8gWGlhb21pIFBPQ09cbiAgICAgICAgL1xcYjsgKFxcdyspIGJ1aWxkXFwvaG1cXDEvaSwgLy8gWGlhb21pIEhvbmdtaSAnbnVtZXJpYycgbW9kZWxzXG4gICAgICAgIC9cXGIoaG1bLV8gXT9ub3RlP1tfIF0/KD86XFxkXFx3KT8pIGJ1aS9pLCAvLyBYaWFvbWkgSG9uZ21pXG4gICAgICAgIC9cXGIocmVkbWlbXFwtXyBdPyg/Om5vdGV8ayk/W1xcd18gXSspKD86IGJ1aXxcXCkpL2ksIC8vIFhpYW9taSBSZWRtaVxuICAgICAgICAvXFxiKG1pWy1fIF0/KD86YVxcZHxvbmV8b25lW18gXXBsdXN8bm90ZSBsdGV8bWF4fGNjKT9bXyBdPyg/OlxcZD9cXHc/KVtfIF0/KD86cGx1c3xzZXxsaXRlKT8pKD86IGJ1aXxcXCkpL2ksXG4gICAgICBdLFxuICAgICAgW1tNT0RFTCwgL18vZywgXCIgXCJdLCBbVkVORE9SLCBYSUFPTUldLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYihtaVstXyBdPyg/OnBhZCkoPzpbXFx3XyBdKykpKD86IGJ1aXxcXCkpL2ldLFxuICAgICAgW1tNT0RFTCwgL18vZywgXCIgXCJdLCBbVkVORE9SLCBYSUFPTUldLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC87IChcXHcrKSBidWkuKyBvcHBvL2ksXG4gICAgICAgIC9cXGIoY3BoWzEyXVxcZHszfXxwKD86YWZ8Y1thbF18ZFxcd3xlW2FyXSlbbXRdXFxkMHx4OTAwN3xhMTAxb3ApXFxiL2ksXG4gICAgICBdLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBcIk9QUE9cIl0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvdml2byAoXFx3KykoPzogYnVpfFxcKSkvaSwgL1xcYih2WzEyXVxcZHszfVxcdz9bYXRdKSg/OiBidWl8OykvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiVml2b1wiXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGIocm14WzEyXVxcZHszfSkoPzogYnVpfDt8XFwpKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgXCJSZWFsbWVcIl0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL1xcYihtaWxlc3RvbmV8ZHJvaWQoPzpbMi00eF18ICg/OmJpb25pY3x4Mnxwcm98cmF6cikpPzo/KCA0Zyk/KVxcYltcXHcgXStidWlsZFxcLy9pLFxuICAgICAgICAvXFxibW90KD86b3JvbGEpP1stIF0oXFx3KikvaSxcbiAgICAgICAgLygoPzptb3RvW1xcd1xcKFxcKSBdK3x4dFxcZHszLDR9fG5leHVzIDYpKD89IGJ1aXxcXCkpKS9pLFxuICAgICAgXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgTU9UT1JPTEFdLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYihtejYwXFxkfHhvb21bMiBdezAsMn0pIGJ1aWxkXFwvL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBNT1RPUk9MQV0sIFtUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKCg/PWxnKT9bdmxda1xcLT9cXGR7M30pIGJ1aXwgM1xcLlstXFx3OyBdezEwfWxnPy0oWzA2Y3Y5XXszLDR9KS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgTEddLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8obG0oPzotP2YxMDBbbnZdP3wtW1xcd1xcLl0rKSg/PSBidWl8XFwpKXxuZXh1cyBbNDVdKS9pLFxuICAgICAgICAvXFxibGdbLWU7XFwvIF0rKCg/IWJyb3dzZXJ8bmV0Y2FzdHxhbmRyb2lkIHR2KVxcdyspL2ksXG4gICAgICAgIC9cXGJsZy0/KFtcXGRcXHddKykgYnVpL2ksXG4gICAgICBdLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBMR10sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhpZGVhdGFiWy1cXHcgXSspL2ksXG4gICAgICAgIC9sZW5vdm8gPyhzWzU2XTAwMFstXFx3XSt8dGFiKD86W1xcdyBdKyl8eXRbLVxcZFxcd117Nn18dGJbLVxcZFxcd117Nn0pL2ksXG4gICAgICBdLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBcIkxlbm92b1wiXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oPzptYWVtb3xub2tpYSkuKihuOTAwfGx1bWlhIFxcZCspL2ksIC9ub2tpYVstXyBdPyhbLVxcd1xcLl0qKS9pXSxcbiAgICAgIFtbTU9ERUwsIC9fL2csIFwiIFwiXSwgW1ZFTkRPUiwgXCJOb2tpYVwiXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8ocGl4ZWwgYylcXGIvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEdPT0dMRV0sIFtUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvZHJvaWQuKzsgKHBpeGVsW1xcZGF4bCBdezAsNn0pKD86IGJ1aXxcXCkpL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBHT09HTEVdLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2Ryb2lkLisgKGE/XFxkWzAtMl17Mn1zb3xbYy1nXVxcZHs0fXxzb1stZ2xdXFx3K3x4cS1hXFx3WzQtN11bMTJdKSg/PSBidWl8XFwpLitjaHJvbWVcXC8oPyFbMS02XXswLDF9XFxkXFwuKSkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFNPTlldLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL3NvbnkgdGFibGV0IFtwc10vaSwgL1xcYig/OnNvbnkpP3NncFxcdysoPzogYnVpfFxcKSkvaV0sXG4gICAgICBbW01PREVMLCBcIlhwZXJpYSBUYWJsZXRcIl0sIFtWRU5ET1IsIFNPTlldLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8gKGtiMjAwNXxpbjIwWzEyXTV8YmUyMFsxMl1bNTldKVxcYi9pLFxuICAgICAgICAvKD86b25lKT8oPzpwbHVzKT8gKGFcXGQwXFxkXFxkKSg/OiBifFxcKSkvaSxcbiAgICAgIF0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiT25lUGx1c1wiXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvKGFsZXhhKXdlYm0vaSxcbiAgICAgICAgLyhrZlthLXpdezJ9d2l8YWVvW2Mtcl17Mn0pKCBidWl8XFwpKS9pLCAvLyBLaW5kbGUgRmlyZSB3aXRob3V0IFNpbGsgLyBFY2hvIFNob3dcbiAgICAgICAgLyhrZlthLXpdKykoIGJ1aXxcXCkpLitzaWxrXFwvL2ksXG4gICAgICBdLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBBTUFaT05dLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLygoPzpzZHxrZilbMDM0OWhpam9yc3R1d10rKSggYnVpfFxcKSkuK3NpbGtcXC8vaV0sXG4gICAgICBbW01PREVMLCAvKC4rKS9nLCBcIkZpcmUgUGhvbmUgJDFcIl0sIFtWRU5ET1IsIEFNQVpPTl0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHBsYXlib29rKTtbLVxcd1xcKSw7IF0rKHJpbSkvaV0sXG4gICAgICBbTU9ERUwsIFZFTkRPUiwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGIoKD86YmJbYS1mXXxzdFtodl0pMTAwLVxcZCkvaSwgL1xcKGJiMTA7IChcXHcrKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgQkxBQ0tCRVJSWV0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKD86XFxifGFzdXNfKSh0cmFuc2ZvW3ByaW1lIF17NCwxMH0gXFx3K3xlZWVwY3xzbGlkZXIgXFx3K3xuZXh1cyA3fHBhZGZvbmV8cDAwW2NqXSkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEFTVVNdLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyAoeltiZXNdNlswMjddWzAxMl1ba21dW2xzXXx6ZW5mb25lIFxcZFxcdz8pXFxiL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBBU1VTXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8obmV4dXMgOSkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiSFRDXCJdLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC8oaHRjKVstO18gXXsxLDJ9KFtcXHcgXSsoPz1cXCl8IGJ1aSl8XFx3KykvaSwgLy8gSFRDXG4gICAgICAgIC8oenRlKVstIF0oW1xcdyBdKz8pKD86IGJ1aXxcXC98XFwpKS9pLFxuICAgICAgICAvKGFsY2F0ZWx8Z2Vla3NwaG9uZXxuZXhpYW58cGFuYXNvbmljKD8hKD86O3xcXC4pKXxzb255KD8hLWJyYSkpWy1fIF0/KFstXFx3XSopL2ksXG4gICAgICBdLFxuICAgICAgW1ZFTkRPUiwgW01PREVMLCAvXy9nLCBcIiBcIl0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvZHJvaWQuKzsgKFthYl1bMS03XS0/WzAxNzhhXVxcZFxcZD8pL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBcIkFjZXJcIl0sIFtUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL2Ryb2lkLis7IChtWzEtNV0gbm90ZSkgYnVpL2ksXG4gICAgICAgIC9cXGJtei0oWy1cXHddezIsfSkvaSxcbiAgICAgIF0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiTWVpenVcIl0sIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhibGFja2JlcnJ5fGJlbnF8cGFsbSg/PVxcLSl8c29ueWVyaWNzc29ufGFjZXJ8YXN1c3xkZWxsfG1laXp1fG1vdG9yb2xhfHBvbHl0cm9ufGluZmluaXh8dGVjbm8pWy1fIF0/KFstXFx3XSopL2ksXG4gICAgICAgIC8vIEJsYWNrQmVycnkvQmVuUS9QYWxtL1NvbnktRXJpY3Nzb24vQWNlci9Bc3VzL0RlbGwvTWVpenUvTW90b3JvbGEvUG9seXRyb25cbiAgICAgICAgLyhocCkgKFtcXHcgXStcXHcpL2ksIC8vIEhQIGlQQVFcbiAgICAgICAgLyhhc3VzKS0/KFxcdyspL2ksIC8vIEFzdXNcbiAgICAgICAgLyhtaWNyb3NvZnQpOyAobHVtaWFbXFx3IF0rKS9pLCAvLyBNaWNyb3NvZnQgTHVtaWFcbiAgICAgICAgLyhsZW5vdm8pWy1fIF0/KFstXFx3XSspL2ksIC8vIExlbm92b1xuICAgICAgICAvKGpvbGxhKS9pLCAvLyBKb2xsYVxuICAgICAgICAvKG9wcG8pID8oW1xcdyBdKykgYnVpL2ksXG4gICAgICBdLFxuICAgICAgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBNT0JJTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhrb2JvKVxccyhlcmVhZGVyfHRvdWNoKS9pLCAvLyBLb2JvXG4gICAgICAgIC8oYXJjaG9zKSAoZ2FtZXBhZDI/KS9pLCAvLyBBcmNob3NcbiAgICAgICAgLyhocCkuKyh0b3VjaHBhZCg/IS4rdGFibGV0KXx0YWJsZXQpL2ksIC8vIEhQIFRvdWNoUGFkXG4gICAgICAgIC8oa2luZGxlKVxcLyhbXFx3XFwuXSspL2ksXG4gICAgICBdLFxuICAgICAgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHN1cmZhY2UgZHVvKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgTUlDUk9TT0ZUXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZCBbXFxkXFwuXSs7IChmcFxcZHU/KSg/OiBifFxcKSkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiRmFpcnBob25lXCJdLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhzaGllbGRbXFx3IF0rKSBiL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBcIk52aWRpYVwiXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oc3ByaW50KSAoXFx3KykvaV0sXG4gICAgICBbVkVORE9SLCBNT0RFTCwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oa2luXFwuW29uZXR3XXszfSkvaV0sXG4gICAgICBbW01PREVMLCAvXFwuL2csIFwiIFwiXSwgW1ZFTkRPUiwgTUlDUk9TT0ZUXSwgW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZC4rOyAoW2M2XSt8ZXQ1WzE2XXxtY1syMzldWzIzXXg/fHZjOFswM114PylcXCkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFpFQlJBXSwgW1RZUEUsIFRBQkxFVF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZC4rOyAoZWMzMHxwczIwfHRjWzItOF1cXGRba3hdKVxcKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgWkVCUkFdLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL3NtYXJ0LXR2Lisoc2Ftc3VuZykvaV0sXG4gICAgICBbVkVORE9SLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9oYmJ0di4rbWFwbGU7KFxcZCspL2ldLFxuICAgICAgW1tNT0RFTCwgL14vLCBcIlNtYXJ0VFZcIl0sIFtWRU5ET1IsIFNBTVNVTkddLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8obnV4OyBuZXRjYXN0LitzbWFydHR2fGxnIChuZXRjYXN0XFwudHYtMjAxXFxkfGFuZHJvaWQgdHYpKS9pXSxcbiAgICAgIFtbVkVORE9SLCBMR10sIFtUWVBFLCBTTUFSVFRWXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhhcHBsZSkgP3R2L2ldLFxuICAgICAgW1ZFTkRPUiwgW01PREVMLCBgJHtBUFBMRX0gVFZgXSwgW1RZUEUsIFNNQVJUVFZdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvY3JrZXkvaV0sXG4gICAgICBbW01PREVMLCBgJHtDSFJPTUV9Y2FzdGBdLCBbVkVORE9SLCBHT09HTEVdLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZC4rYWZ0KFxcdykoIGJ1aXxcXCkpL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBBTUFaT05dLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXChkdHZbXFwpO10uKyhhcXVvcykvaSwgLyhhcXVvcy10dltcXHcgXSspXFwpL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBTSEFSUF0sIFtUWVBFLCBTTUFSVFRWXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhicmF2aWFbXFx3IF0rKSggYnVpfFxcKSkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFNPTlldLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8obWl0di1cXHd7NX0pIGJ1aS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgWElBT01JXSwgW1RZUEUsIFNNQVJUVFZdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvSGJidHYuKih0ZWNobmlzYXQpICguKik7L2ldLFxuICAgICAgW1ZFTkRPUiwgTU9ERUwsIFtUWVBFLCBTTUFSVFRWXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC9cXGIocm9rdSlbXFxkeF0qW1xcKVxcL10oKD86ZHZwLSk/W1xcZFxcLl0qKS9pLCAvLyBSb2t1XG4gICAgICAgIC9oYmJ0dlxcL1xcZCtcXC5cXGQrXFwuXFxkKyArXFwoW1xcd1xcKyBdKjsgKihbXFx3XFxkXVteO10qKTsoW147XSopL2ksXG4gICAgICBdLFxuICAgICAgW1tWRU5ET1IsIHRyaW1dLCBbTU9ERUwsIHRyaW1dLCBbVFlQRSwgU01BUlRUVl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGIoYW5kcm9pZCB0dnxzbWFydFstIF0/dHZ8b3BlcmEgdHZ8dHY7IHJ2OilcXGIvaV0sXG4gICAgICBbW1RZUEUsIFNNQVJUVFZdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhvdXlhKS9pLCAvLyBPdXlhXG4gICAgICAgIC8obmludGVuZG8pIChcXHcrKS9pLFxuICAgICAgXSxcbiAgICAgIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgQ09OU09MRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZC4rOyAoc2hpZWxkKSBidWkvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFwiTnZpZGlhXCJdLCBbVFlQRSwgQ09OU09MRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8ocGxheXN0YXRpb24gXFx3KykvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIFNPTlldLCBbVFlQRSwgQ09OU09MRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9cXGIoeGJveCg/OiBvbmUpPyg/ITsgeGJveCkpW1xcKTsgXS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgTUlDUk9TT0ZUXSwgW1RZUEUsIENPTlNPTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKChwZWJibGUpKWFwcC9pXSxcbiAgICAgIFtWRU5ET1IsIE1PREVMLCBbVFlQRSwgV0VBUkFCTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHdhdGNoKSg/OiA/b3NbLFxcL118XFxkLFxcZFxcLylbXFxkXFwuXSsvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEFQUExFXSwgW1RZUEUsIFdFQVJBQkxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2Ryb2lkLis7IChnbGFzcykgXFxkL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBHT09HTEVdLCBbVFlQRSwgV0VBUkFCTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvZHJvaWQuKzsgKHd0NjM/MHsyLDN9KVxcKS9pXSxcbiAgICAgIFtNT0RFTCwgW1ZFTkRPUiwgWkVCUkFdLCBbVFlQRSwgV0VBUkFCTEVdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHF1ZXN0KCAyfCBwcm8pPykvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEZBQ0VCT09LXSwgW1RZUEUsIFdFQVJBQkxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyh0ZXNsYSkoPzogcXRjYXJicm93c2VyfFxcL1stXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFTkRPUiwgW1RZUEUsIEVNQkVEREVEXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhhZW9iYylcXGIvaV0sXG4gICAgICBbTU9ERUwsIFtWRU5ET1IsIEFNQVpPTl0sIFtUWVBFLCBFTUJFRERFRF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy9kcm9pZCAuKz87IChbXjtdKz8pKD86IGJ1aXxcXCkgYXBwbGV3KS4rPyBtb2JpbGUgc2FmYXJpL2ldLFxuICAgICAgW01PREVMLCBbVFlQRSwgTU9CSUxFXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2Ryb2lkIC4rPzsgKFteO10rPykoPzogYnVpfFxcKSBhcHBsZXcpLis/KD8hIG1vYmlsZSkgc2FmYXJpL2ldLFxuICAgICAgW01PREVMLCBbVFlQRSwgVEFCTEVUXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcYigodGFibGV0fHRhYilbO1xcL118Zm9jdXNcXC9cXGQoPyEuK21vYmlsZSkpL2ldLFxuICAgICAgW1tUWVBFLCBUQUJMRVRdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHBob25lfG1vYmlsZSg/Ols7XFwvXXwgWyBcXHdcXC9cXC5dKnNhZmFyaSl8cGRhKD89Lit3aW5kb3dzIGNlKSkvaV0sXG4gICAgICBbW1RZUEUsIE1PQklMRV1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oYW5kcm9pZFstXFx3XFwuIF17MCw5fSk7LitidWlsL2ldLFxuICAgICAgW01PREVMLCBbVkVORE9SLCBcIkdlbmVyaWNcIl1dLFxuICAgIF0sXG4gIF0sXG4gIGVuZ2luZTogW1xuICAgIFtcbiAgICAgIFsvd2luZG93cy4rIGVkZ2VcXC8oW1xcd1xcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7RURHRX1IVE1MYF1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy93ZWJraXRcXC81MzdcXC4zNi4rY2hyb21lXFwvKD8hMjcpKFtcXHdcXC5dKykvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIFwiQmxpbmtcIl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvKHByZXN0bylcXC8oW1xcd1xcLl0rKS9pLCAvLyBQcmVzdG9cbiAgICAgICAgLyh3ZWJraXR8dHJpZGVudHxuZXRmcm9udHxuZXRzdXJmfGFtYXlhfGx5bnh8dzNtfGdvYW5uYSlcXC8oW1xcd1xcLl0rKS9pLCAvLyBXZWJLaXQvVHJpZGVudC9OZXRGcm9udC9OZXRTdXJmL0FtYXlhL0x5bngvdzNtL0dvYW5uYVxuICAgICAgICAvZWtpb2goZmxvdylcXC8oW1xcd1xcLl0rKS9pLCAvLyBGbG93XG4gICAgICAgIC8oa2h0bWx8dGFzbWFufGxpbmtzKVtcXC8gXVxcKD8oW1xcd1xcLl0rKS9pLCAvLyBLSFRNTC9UYXNtYW4vTGlua3NcbiAgICAgICAgLyhpY2FiKVtcXC8gXShbMjNdXFwuW1xcZFxcLl0rKS9pLCAvLyBpQ2FiXG4gICAgICAgIC9cXGIobGlid2ViKS9pLFxuICAgICAgXSxcbiAgICAgIFtOQU1FLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvcnZcXDooW1xcd1xcLl17MSw5fSlcXGIuKyhnZWNrbykvaV0sXG4gICAgICBbVkVSU0lPTiwgTkFNRV0sXG4gICAgXSxcbiAgXSxcbiAgb3M6IFtcbiAgICBbXG4gICAgICBbL21pY3Jvc29mdCAod2luZG93cykgKHZpc3RhfHhwKS9pXSxcbiAgICAgIFtOQU1FLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyh3aW5kb3dzKSBudCA2XFwuMjsgKGFybSkvaSwgLy8gV2luZG93cyBSVFxuICAgICAgICAvKHdpbmRvd3MgKD86cGhvbmUoPzogb3MpP3xtb2JpbGUpKVtcXC8gXT8oW1xcZFxcLlxcdyBdKikvaSwgLy8gV2luZG93cyBQaG9uZVxuICAgICAgICAvKHdpbmRvd3MpW1xcLyBdPyhbbnRjZVxcZFxcLiBdK1xcdykoPyEuK3hib3gpL2ksXG4gICAgICBdLFxuICAgICAgW05BTUUsIFtWRVJTSU9OLCBtYXBXaW5WZXJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKHdpbig/PTN8OXxuKXx3aW4gOXggKShbbnRcXGRcXC5dKykvaV0sXG4gICAgICBbW05BTUUsIFdJTkRPV1NdLCBbVkVSU0lPTiwgbWFwV2luVmVyXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbXG4gICAgICAgIC9pcFtob25lYWRdezIsNH1cXGIoPzouKm9zIChbXFx3XSspIGxpa2UgbWFjfDsgb3BlcmEpL2ksIC8vIGlPU1xuICAgICAgICAvKD86aW9zO2Zic3ZcXC98aXBob25lLitpb3NbXFwvIF0pKFtcXGRcXC5dKykvaSxcbiAgICAgICAgL2NmbmV0d29ya1xcLy4rZGFyd2luL2ksXG4gICAgICBdLFxuICAgICAgW1tWRVJTSU9OLCAvXy9nLCBcIi5cIl0sIFtOQU1FLCBcImlPU1wiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhtYWMgb3MgeCkgPyhbXFx3XFwuIF0qKS9pLCAvKG1hY2ludG9zaHxtYWNfcG93ZXJwY1xcYikoPyEuK2hhaWt1KS9pXSxcbiAgICAgIFtbTkFNRSwgXCJtYWNPU1wiXSwgW1ZFUlNJT04sIC9fL2csIFwiLlwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL2Ryb2lkIChbXFx3XFwuXSspXFxiLisoYW5kcm9pZFstIF14ODZ8aGFybW9ueW9zKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBOQU1FXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLyhhbmRyb2lkfHdlYm9zfHFueHxiYWRhfHJpbSB0YWJsZXQgb3N8bWFlbW98bWVlZ298c2FpbGZpc2gpWy1cXC8gXT8oW1xcd1xcLl0qKS9pLFxuICAgICAgICAvKGJsYWNrYmVycnkpXFx3KlxcLyhbXFx3XFwuXSopL2ksIC8vIEJsYWNrYmVycnlcbiAgICAgICAgLyh0aXplbnxrYWlvcylbXFwvIF0oW1xcd1xcLl0rKS9pLCAvLyBUaXplbi9LYWlPU1xuICAgICAgICAvXFwoKHNlcmllczQwKTsvaSxcbiAgICAgIF0sXG4gICAgICBbTkFNRSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL1xcKGJiKDEwKTsvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIEJMQUNLQkVSUlldXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvKD86c3ltYmlhbiA/b3N8c3ltYm9zfHM2MCg/PTspfHNlcmllczYwKVstXFwvIF0/KFtcXHdcXC5dKikvaV0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIFwiU3ltYmlhblwiXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbL21vemlsbGFcXC9bXFxkXFwuXSsgXFwoKD86bW9iaWxlfHRhYmxldHx0dnxtb2JpbGU7IFtcXHcgXSspOyBydjouKyBnZWNrb1xcLyhbXFx3XFwuXSspL2ldLFxuICAgICAgW1ZFUlNJT04sIFtOQU1FLCBgJHtGSVJFRk9YfSBPU2BdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgL3dlYjBzOy4rcnQodHYpL2ksXG4gICAgICAgIC9cXGIoPzpocCk/d29zKD86YnJvd3Nlcik/XFwvKFtcXHdcXC5dKykvaSxcbiAgICAgIF0sXG4gICAgICBbVkVSU0lPTiwgW05BTUUsIFwid2ViT1NcIl1dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy93YXRjaCg/OiA/b3NbLFxcL118XFxkLFxcZFxcLykoW1xcZFxcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgXCJ3YXRjaE9TXCJdXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFsvY3JrZXlcXC8oW1xcZFxcLl0rKS9pXSxcbiAgICAgIFtWRVJTSU9OLCBbTkFNRSwgYCR7Q0hST01FfWNhc3RgXV0sXG4gICAgXSxcbiAgICBbXG4gICAgICBbLyhjcm9zKSBbXFx3XSsoPzpcXCl8IChbXFx3XFwuXSspXFxiKS9pXSxcbiAgICAgIFtbTkFNRSwgXCJDaHJvbWUgT1NcIl0sIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgW1xuICAgICAgICAvcGFuYXNvbmljOyh2aWVyYSkvaSwgLy8gUGFuYXNvbmljIFZpZXJhXG4gICAgICAgIC8obmV0cmFuZ2UpbW1oL2ksIC8vIE5ldHJhbmdlXG4gICAgICAgIC8obmV0dHYpXFwvKFxcZCtcXC5bXFx3XFwuXSspL2ksIC8vIE5ldFRWXG5cbiAgICAgICAgLy8gQ29uc29sZVxuICAgICAgICAvKG5pbnRlbmRvfHBsYXlzdGF0aW9uKSAoXFx3KykvaSwgLy8gTmludGVuZG8vUGxheXN0YXRpb25cbiAgICAgICAgLyh4Ym94KTsgK3hib3ggKFteXFwpO10rKS9pLCAvLyBNaWNyb3NvZnQgWGJveCAoMzYwLCBPbmUsIFgsIFMsIFNlcmllcyBYLCBTZXJpZXMgUylcblxuICAgICAgICAvLyBPdGhlclxuICAgICAgICAvXFxiKGpvbGl8cGFsbSlcXGIgPyg/Om9zKT9cXC8/KFtcXHdcXC5dKikvaSwgLy8gSm9saS9QYWxtXG4gICAgICAgIC8obWludClbXFwvXFwoXFwpIF0/KFxcdyopL2ksIC8vIE1pbnRcbiAgICAgICAgLyhtYWdlaWF8dmVjdG9ybGludXgpWzsgXS9pLCAvLyBNYWdlaWEvVmVjdG9yTGludXhcbiAgICAgICAgLyhba3hsbl0/dWJ1bnR1fGRlYmlhbnxzdXNlfG9wZW5zdXNlfGdlbnRvb3xhcmNoKD89IGxpbnV4KXxzbGFja3dhcmV8ZmVkb3JhfG1hbmRyaXZhfGNlbnRvc3xwY2xpbnV4b3N8cmVkID9oYXR8emVud2Fsa3xsaW5wdXN8cmFzcGJpYW58cGxhbiA5fG1pbml4fHJpc2Mgb3N8Y29udGlraXxkZWVwaW58bWFuamFyb3xlbGVtZW50YXJ5IG9zfHNhYmF5b258bGluc3BpcmUpKD86IGdudVxcL2xpbnV4KT8oPzogZW50ZXJwcmlzZSk/KD86Wy0gXWxpbnV4KT8oPzotZ251KT9bLVxcLyBdPyg/IWNocm9tfHBhY2thZ2UpKFstXFx3XFwuXSopL2ksXG4gICAgICAgIC8vIFVidW50dS9EZWJpYW4vU1VTRS9HZW50b28vQXJjaC9TbGFja3dhcmUvRmVkb3JhL01hbmRyaXZhL0NlbnRPUy9QQ0xpbnV4T1MvUmVkSGF0L1plbndhbGsvTGlucHVzL1Jhc3BiaWFuL1BsYW45L01pbml4L1JJU0NPUy9Db250aWtpL0RlZXBpbi9NYW5qYXJvL2VsZW1lbnRhcnkvU2FiYXlvbi9MaW5zcGlyZVxuICAgICAgICAvKGh1cmR8bGludXgpID8oW1xcd1xcLl0qKS9pLCAvLyBIdXJkL0xpbnV4XG4gICAgICAgIC8oZ251KSA/KFtcXHdcXC5dKikvaSwgLy8gR05VXG4gICAgICAgIC9cXGIoWy1mcmVudG9wY2doc117MCw1fWJzZHxkcmFnb25mbHkpW1xcLyBdPyg/IWFtZHxbaXgzNDZdezEsMn04NikoW1xcd1xcLl0qKS9pLCAvLyBGcmVlQlNEL05ldEJTRC9PcGVuQlNEL1BDLUJTRC9HaG9zdEJTRC9EcmFnb25GbHlcbiAgICAgICAgLyhoYWlrdSkgKFxcdyspL2ksXG4gICAgICBdLFxuICAgICAgW05BTUUsIFZFUlNJT05dLFxuICAgIF0sXG4gICAgW1xuICAgICAgWy8oc3Vub3MpID8oW1xcd1xcLlxcZF0qKS9pXSxcbiAgICAgIFtbTkFNRSwgXCJTb2xhcmlzXCJdLCBWRVJTSU9OXSxcbiAgICBdLFxuICAgIFtcbiAgICAgIFtcbiAgICAgICAgLygoPzpvcGVuKT9zb2xhcmlzKVstXFwvIF0/KFtcXHdcXC5dKikvaSwgLy8gU29sYXJpc1xuICAgICAgICAvKGFpeCkgKChcXGQpKD89XFwufFxcKXwgKVtcXHdcXC5dKSovaSwgLy8gQUlYXG4gICAgICAgIC9cXGIoYmVvc3xvc1xcLzJ8YW1pZ2Fvc3xtb3JwaG9zfG9wZW52bXN8ZnVjaHNpYXxocC11eHxzZXJlbml0eW9zKS9pLCAvLyBCZU9TL09TMi9BbWlnYU9TL01vcnBoT1MvT3BlblZNUy9GdWNoc2lhL0hQLVVYL1NlcmVuaXR5T1NcbiAgICAgICAgLyh1bml4KSA/KFtcXHdcXC5dKikvaSxcbiAgICAgIF0sXG4gICAgICBbTkFNRSwgVkVSU0lPTl0sXG4gICAgXSxcbiAgXSxcbn07XG5cbmV4cG9ydCBjbGFzcyBVc2VyQWdlbnQge1xuICAjYnJvd3Nlcj86IEJyb3dzZXI7XG4gICNjcHU/OiBDcHU7XG4gICNkZXZpY2U/OiBEZXZpY2U7XG4gICNlbmdpbmU/OiBFbmdpbmU7XG4gICNvcz86IE9zO1xuICAjdWE6IHN0cmluZztcblxuICAvKiogQSByZXByZXNlbnRhdGlvbiBvZiB1c2VyIGFnZW50IHN0cmluZywgd2hpY2ggY2FuIGJlIHVzZWQgdG8gZGV0ZXJtaW5lXG4gICAqIGVudmlyb25tZW50YWwgaW5mb3JtYXRpb24gcmVwcmVzZW50ZWQgYnkgdGhlIHN0cmluZy4gQWxsIHByb3BlcnRpZXMgYXJlXG4gICAqIGRldGVybWluZWQgbGF6aWx5LlxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBVc2VyQWdlbnQgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9odHRwL3VzZXJfYWdlbnQudHNcIjtcbiAgICpcbiAgICogRGVuby5zZXJ2ZSgocmVxKSA9PiB7XG4gICAqICAgY29uc3QgdXNlckFnZW50ID0gbmV3IFVzZXJBZ2VudChyZXEuaGVhZGVycy5nZXQoXCJ1c2VyLWFnZW50XCIpID8/IFwiXCIpO1xuICAgKiAgIHJldHVybiBuZXcgUmVzcG9uc2UoYEhlbGxvLCAke3VzZXJBZ2VudC5icm93c2VyLm5hbWV9XG4gICAqICAgICBvbiAke3VzZXJBZ2VudC5vcy5uYW1lfSAke3VzZXJBZ2VudC5vcy52ZXJzaW9ufSFgKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgY29uc3RydWN0b3IodWE6IHN0cmluZyB8IG51bGwpIHtcbiAgICB0aGlzLiN1YSA9IHVhID8/IFwiXCI7XG4gIH1cblxuICAvKiogVGhlIG5hbWUgYW5kIHZlcnNpb24gb2YgdGhlIGJyb3dzZXIgZXh0cmFjdGVkIGZyb20gdGhlIHVzZXIgYWdlbnRcbiAgICogc3RyaW5nLiAqL1xuICBnZXQgYnJvd3NlcigpOiBCcm93c2VyIHtcbiAgICBpZiAoIXRoaXMuI2Jyb3dzZXIpIHtcbiAgICAgIHRoaXMuI2Jyb3dzZXIgPSB7IG5hbWU6IHVuZGVmaW5lZCwgdmVyc2lvbjogdW5kZWZpbmVkLCBtYWpvcjogdW5kZWZpbmVkIH07XG4gICAgICBtYXBwZXIodGhpcy4jYnJvd3NlciwgdGhpcy4jdWEsIG1hdGNoZXJzLmJyb3dzZXIpO1xuICAgICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgICh0aGlzLiNicm93c2VyIGFzIGFueSkubWFqb3IgPSBtYWpvcml6ZSh0aGlzLiNicm93c2VyLnZlcnNpb24pO1xuICAgICAgT2JqZWN0LmZyZWV6ZSh0aGlzLiNicm93c2VyKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuI2Jyb3dzZXI7XG4gIH1cblxuICAvKiogVGhlIGFyY2hpdGVjdHVyZSBvZiB0aGUgQ1BVIGV4dHJhY3RlZCBmcm9tIHRoZSB1c2VyIGFnZW50IHN0cmluZy4gKi9cbiAgZ2V0IGNwdSgpOiBDcHUge1xuICAgIGlmICghdGhpcy4jY3B1KSB7XG4gICAgICB0aGlzLiNjcHUgPSB7IGFyY2hpdGVjdHVyZTogdW5kZWZpbmVkIH07XG4gICAgICBtYXBwZXIodGhpcy4jY3B1LCB0aGlzLiN1YSwgbWF0Y2hlcnMuY3B1KTtcbiAgICAgIE9iamVjdC5mcmVlemUodGhpcy4jY3B1KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuI2NwdTtcbiAgfVxuXG4gIC8qKiBUaGUgbW9kZWwsIHR5cGUsIGFuZCB2ZW5kb3Igb2YgYSBkZXZpY2UgaWYgcHJlc2VudCBpbiBhIHVzZXIgYWdlbnRcbiAgICogc3RyaW5nLiAqL1xuICBnZXQgZGV2aWNlKCk6IERldmljZSB7XG4gICAgaWYgKCF0aGlzLiNkZXZpY2UpIHtcbiAgICAgIHRoaXMuI2RldmljZSA9IHsgbW9kZWw6IHVuZGVmaW5lZCwgdHlwZTogdW5kZWZpbmVkLCB2ZW5kb3I6IHVuZGVmaW5lZCB9O1xuICAgICAgbWFwcGVyKHRoaXMuI2RldmljZSwgdGhpcy4jdWEsIG1hdGNoZXJzLmRldmljZSk7XG4gICAgICBPYmplY3QuZnJlZXplKHRoaXMuI2RldmljZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiNkZXZpY2U7XG4gIH1cblxuICAvKiogVGhlIG5hbWUgYW5kIHZlcnNpb24gb2YgdGhlIGJyb3dzZXIgZW5naW5lIGluIGEgdXNlciBhZ2VudCBzdHJpbmcuICovXG4gIGdldCBlbmdpbmUoKTogRW5naW5lIHtcbiAgICBpZiAoIXRoaXMuI2VuZ2luZSkge1xuICAgICAgdGhpcy4jZW5naW5lID0geyBuYW1lOiB1bmRlZmluZWQsIHZlcnNpb246IHVuZGVmaW5lZCB9O1xuICAgICAgbWFwcGVyKHRoaXMuI2VuZ2luZSwgdGhpcy4jdWEsIG1hdGNoZXJzLmVuZ2luZSk7XG4gICAgICBPYmplY3QuZnJlZXplKHRoaXMuI2VuZ2luZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiNlbmdpbmU7XG4gIH1cblxuICAvKiogVGhlIG5hbWUgYW5kIHZlcnNpb24gb2YgdGhlIG9wZXJhdGluZyBzeXN0ZW0gaW4gYSB1c2VyIGFnZW50IHN0cmluZy4gKi9cbiAgZ2V0IG9zKCk6IE9zIHtcbiAgICBpZiAoIXRoaXMuI29zKSB7XG4gICAgICB0aGlzLiNvcyA9IHsgbmFtZTogdW5kZWZpbmVkLCB2ZXJzaW9uOiB1bmRlZmluZWQgfTtcbiAgICAgIG1hcHBlcih0aGlzLiNvcywgdGhpcy4jdWEsIG1hdGNoZXJzLm9zKTtcbiAgICAgIE9iamVjdC5mcmVlemUodGhpcy4jb3MpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy4jb3M7XG4gIH1cblxuICAvKiogQSByZWFkIG9ubHkgdmVyc2lvbiBvZiB0aGUgdXNlciBhZ2VudCBzdHJpbmcgcmVsYXRlZCB0byB0aGUgaW5zdGFuY2UuICovXG4gIGdldCB1YSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLiN1YTtcbiAgfVxuXG4gIHRvSlNPTigpIHtcbiAgICBjb25zdCB7IGJyb3dzZXIsIGNwdSwgZGV2aWNlLCBlbmdpbmUsIG9zLCB1YSB9ID0gdGhpcztcbiAgICByZXR1cm4geyBicm93c2VyLCBjcHUsIGRldmljZSwgZW5naW5lLCBvcywgdWEgfTtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuI3VhO1xuICB9XG5cbiAgW1N5bWJvbC5mb3IoXCJEZW5vLmN1c3RvbUluc3BlY3RcIildKFxuICAgIGluc3BlY3Q6ICh2YWx1ZTogdW5rbm93bikgPT4gc3RyaW5nLFxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IHsgYnJvd3NlciwgY3B1LCBkZXZpY2UsIGVuZ2luZSwgb3MsIHVhIH0gPSB0aGlzO1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHsgYnJvd3NlciwgY3B1LCBkZXZpY2UsIGVuZ2luZSwgb3MsIHVhIH0pXG4gICAgfWA7XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIm5vZGVqcy51dGlsLmluc3BlY3QuY3VzdG9tXCIpXShcbiAgICBkZXB0aDogbnVtYmVyLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgb3B0aW9uczogYW55LFxuICAgIGluc3BlY3Q6ICh2YWx1ZTogdW5rbm93biwgb3B0aW9ucz86IHVua25vd24pID0+IHN0cmluZyxcbiAgKTogc3RyaW5nIHtcbiAgICBpZiAoZGVwdGggPCAwKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5zdHlsaXplKGBbJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9XWAsIFwic3BlY2lhbFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdPcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge1xuICAgICAgZGVwdGg6IG9wdGlvbnMuZGVwdGggPT09IG51bGwgPyBudWxsIDogb3B0aW9ucy5kZXB0aCAtIDEsXG4gICAgfSk7XG4gICAgY29uc3QgeyBicm93c2VyLCBjcHUsIGRldmljZSwgZW5naW5lLCBvcywgdWEgfSA9IHRoaXM7XG4gICAgcmV0dXJuIGAke29wdGlvbnMuc3R5bGl6ZSh0aGlzLmNvbnN0cnVjdG9yLm5hbWUsIFwic3BlY2lhbFwiKX0gJHtcbiAgICAgIGluc3BlY3QoXG4gICAgICAgIHsgYnJvd3NlciwgY3B1LCBkZXZpY2UsIGVuZ2luZSwgb3MsIHVhIH0sXG4gICAgICAgIG5ld09wdGlvbnMsXG4gICAgICApXG4gICAgfWA7XG4gIH1cbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwwRUFBMEU7QUFDMUUscUNBQXFDO0FBRXJDLG1EQUFtRDtBQUNuRCx5RUFBeUU7QUFDekUsMERBQTBEO0FBRTFEOzs7O0NBSUMsR0FFRCxTQUFTLE1BQU0sUUFBUSxzQkFBc0I7QUFFN0MsTUFBTSxlQUFlO0FBQ3JCLE1BQU0sUUFBUTtBQUNkLE1BQU0sT0FBTztBQUNiLE1BQU0sT0FBTztBQUNiLE1BQU0sU0FBUztBQUNmLE1BQU0sVUFBVTtBQUNoQixNQUFNLFFBQVE7QUFFZCxNQUFNLFVBQVU7QUFDaEIsTUFBTSxXQUFXO0FBQ2pCLE1BQU0sU0FBUztBQUNmLE1BQU0sU0FBUztBQUNmLE1BQU0sVUFBVTtBQUNoQixNQUFNLFdBQVc7QUFFakIsTUFBTSxnQkFBZ0I7QUFDdEIsTUFBTSxpQkFBaUI7QUFFdkIsTUFBTSxTQUFTO0FBQ2YsTUFBTSxRQUFRO0FBQ2QsTUFBTSxPQUFPO0FBQ2IsTUFBTSxhQUFhO0FBQ25CLE1BQU0sU0FBUztBQUNmLE1BQU0sT0FBTztBQUNiLE1BQU0sV0FBVztBQUNqQixNQUFNLFVBQVU7QUFDaEIsTUFBTSxTQUFTO0FBQ2YsTUFBTSxTQUFTO0FBQ2YsTUFBTSxLQUFLO0FBQ1gsTUFBTSxZQUFZO0FBQ2xCLE1BQU0sV0FBVztBQUNqQixNQUFNLFFBQVE7QUFDZCxNQUFNLFVBQVU7QUFDaEIsTUFBTSxRQUFRO0FBQ2QsTUFBTSxPQUFPO0FBQ2IsTUFBTSxVQUFVO0FBQ2hCLE1BQU0sU0FBUztBQUNmLE1BQU0sUUFBUTtBQTREZCxTQUFTLFNBQVMsR0FBVztFQUMzQixPQUFPLElBQUksV0FBVztBQUN4QjtBQUVBLFNBQVMsU0FBUyxHQUF1QjtFQUN2QyxPQUFPLE1BQU0sSUFBSSxPQUFPLENBQUMsWUFBWSxPQUFPLEtBQUssQ0FB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QU87T0FBQztLQUN2RDtJQUNEO01BQ0U7UUFBQztPQUE2QztNQUM5QztRQUFDO1VBQUM7VUFBTztVQUFNO1NBQUk7UUFBRTtVQUFDO1VBQVE7U0FBTztRQUFFO1VBQUM7VUFBTTtTQUFPO09BQUM7S0FDdkQ7SUFDRDtNQUNFO1FBQ0U7UUFDQTtPQUNEO01BQ0Q7UUFBQztRQUFPO1VBQUM7VUFBUTtTQUFPO1FBQUU7VUFBQztVQUFNO1NBQU87T0FBQztLQUMxQztJQUNEO01BQ0U7UUFBQztRQUEwQjtPQUFtQztNQUM5RDtRQUFDO1FBQU87VUFBQztVQUFRO1NBQU87UUFBRTtVQUFDO1VBQU07U0FBTztPQUFDO0tBQzFDO0lBQ0Q7TUFDRTtRQUFDO09BQWlDO01BQ2xDO1FBQUM7UUFBTztVQUFDO1VBQVE7U0FBUztRQUFFO1VBQUM7VUFBTTtTQUFPO09BQUM7S0FDNUM7SUFDRDtNQUNFO1FBQ0U7UUFDQTtRQUNBO09BQ0Q7TUFDRDtRQUFDO1FBQU87VUFBQztVQUFRO1NBQVM7UUFBRTtVQUFDO1VBQU07U0FBTztPQUFDO0tBQzVDO0lBQ0Q7TUFDRTtRQUFDO09BQW9DO01BQ3JDO1FBQUM7UUFBTztVQUFDO1VBQVE7U0FBUztRQUFFO1VBQUM7VUFBTTtTQUFPO09BQUM7S0FDNUM7SUFDRDtNQUNFO1FBQUM7T0FBZ0U7TUFDakU7UUFBQztRQUFPO1VBQUM7VUFBUTtTQUFHO1FBQUU7VUFBQztVQUFNO1NBQU87T0FBQztLQUN0QztJQUNEO01BQ0U7UUFDRTtRQUNBO1FBQ0E7T0FDRDtNQUNEO1FBQUM7UUFBTztVQUFDO1VBQVE7U0FBRztRQUFFO1VBQUM7VUFBTTtTQUFPO09BQUM7S0FDdEM7SUFDRDtNQUNFO1FBQ0U7UUFDQTtPQUNEO01BQ0Q7UUFBQztRQUFPO1VBQUM7VUFBUTtTQUFTO1FBQUU7VUFBQztVQUFNO1NBQU87T0FBQztLQUM1QztJQUNEO01BQ0U7UUFBQztRQUFzQztPQUF5QjtNQUNoRTtRQUFDO1VBQUM7VUFBTztVQUFNO1NBQUk7UUFBRTtVQUFDO1VBQVE7U0FBUTtRQUFFO1VBQUM7VUFB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