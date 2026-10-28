/** string → UTF-8 字节。与小程序 `Base64.utob` 的结果对合法输入完全一致。 */
export declare function utf8(text: string): Uint8Array;
/** UTF-8 字节 → string。非忠实序列按替换字符处理（与 mp 的 `btou` 同样不抛）。 */
export declare function fromUtf8(bytes: Uint8Array): string;
/** 字节 → 标准 base64（带 padding）。 */
export declare function toBase64(bytes: Uint8Array): string;
/** 标准 base64 → 字节。非法输入不抛（见文件头的「有意的不对称」）。 */
export declare function fromBase64(text: string): Uint8Array;
/** 按顺序拼接若干字节段。 */
export declare function concat(parts: readonly Uint8Array[]): Uint8Array;
