/**
 * 加密常量 —— 运行时（src/dict/crypto.ts）与构建期（wxt.config.ts / tools/encrypt-dict.ts）共用。
 *
 * ⚠️ 这些常量改动必须在两侧同时生效，否则解密静默失败。
 * 之所以能单点定义，是因为运行时用 WebCrypto、构建期也用 WebCrypto（Node 20+ 内置），
 * 同一份实现两边都能跑。
 */

/** 解密口令 —— 明文，因为加密目的是防爬虫而不是防逆向（见 src/dict/crypto.ts 顶部说明） */
export const PASSPHRASE = "xy-slang|@goofish|_v2_helper";

/** 固定 16 字节 salt（hex） */
export const SALT_HEX = "9f3a82b1e7c4d605a8f29b1c4d7e0a36";

export const PBKDF2_ITERS = 100_000;
export const KEY_LEN = 256;

/** 输出目录里的词典文件名（由 wxt.config.ts 的 build:publicAssets 注入） */
export const ENC_FILE = "dictionary.enc.json";
export const PLAIN_FILE = "dictionary.source.json";

/** 同上的输出根目录绝对路径形式，供 browser.runtime.getURL 使用（WXT 的 PublicPath 类型带前导斜杠） */
export const ENC_PATH = "/dictionary.enc.json";
export const PLAIN_PATH = "/dictionary.source.json";

/** 注入这些资源的内容脚本匹配规则（manifest 与 web_accessible_resources 共用） */
export const DICT_MATCHES = ["*://*.goofish.com/*", "*://*.xianyu.com/*", "*://2.taobao.com/*"];
