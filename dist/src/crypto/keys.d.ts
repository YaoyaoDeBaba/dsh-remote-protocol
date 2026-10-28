/** KDF 命名空间。**确切拼写**已被小程序侧固定。 */
export declare const KDF_NAMESPACE = "dsh-rc/v1";
/** 客户端计数器 nonce 前缀的命名空间。 */
export declare const NONCE_NAMESPACE = "dsh-rc/v1/nonce";
export declare const KEY_BYTES = 32;
export declare const NONCE_BYTES = 24;
export declare const PSK_BYTES = 16;
/** 计数器 nonce 的固定前缀长度；其余 8 字节是大端计数器。 */
export declare const NONCE_PREFIX_BYTES: number;
/** 会话密钥的方向。两个方向必须得到**不同**的密钥。 */
export type Direction = 'c2h' | 'h2c';
/** KDF 的一部分：字符串按 UTF-8，字节段原样。 */
export type KdfPart = string | Uint8Array;
/**
 * `SHA-512(p0 ‖ 0x1f ‖ p1 ‖ 0x1f ‖ … ‖ pn ‖ 0x1f)` 取**前 32 字节**。
 *
 * 注意「含最后一个部分之后也要补分隔符」——这是最容易写错的一处，
 * 也是小程序与 Node 两侧曾经真正分叉过的地方（取证 legacy-spec/relay-and-wireformat.md §3.2）。
 */
export declare function kdfHash(parts: readonly KdfPart[]): Uint8Array;
/**
 * 从配对 PSK 派生某个会话、某个方向的会话密钥。
 *
 * parts 顺序固定为 `[命名空间, 方向, 会话 id, PSK 原始字节]`——
 * PSK 传的是**解码后的字节**，不是 base64 文本（B5）。
 *
 * **解码后必须正好 16 字节**（2026-10-06 审计）：`fromBase64` 对非法字符是宽容的
 * （见 bytes.ts 的"有意的不对称"），而宽容在那条路径上安全是因为后面还有 Poly1305；
 * KDF 路径**没有**那层兜底——一把被截断的 PSK 会静默派生出一把错钥，用户看到的是
 * "配对显示成功、每一帧都解不开"。宁可在入口就抛。
 */
export declare function derivePskKey(pskBase64: string, direction: Direction, conversationId: string): Uint8Array;
/** 解码 PSK 并校验长度；形状不对即抛（见 derivePskKey 的注释）。 */
export declare function pskBytes(pskBase64: string): Uint8Array;
/**
 * 计数器 nonce 的 16 字节前缀。
 *
 * 唯一性论证（也是小程序敢用无 CSPRNG 的计数器方案的理由）：会话密钥已经绑定了
 * `(PSK, 会话, 方向)`，前缀又绑定了 `installId`；存储被清空时 `installId` 与配对一起消失，
 * 所以 `(key, nonce)` 组合不可能复用（取证 legacy-spec/mp-client-contract.md §5.2）。
 */
export declare function noncePrefix(pskBase64: string, conversationId: string, installId: string): Uint8Array;
/**
 * `prefix(16B) ‖ counter(8B 大端)` → 24 字节 nonce。
 *
 * 大端是硬要求（B6）：字节序一改，两侧计数器含义就不同，而**看起来仍然能用**。
 * 计数器允许出现空洞（小程序在真正发出之前就先加一，丢帧/发送失败都会跳过值），
 * 所以任何一侧都不许推断"下一个应该是几"。
 */
export declare function buildCounterNonce(prefix: Uint8Array, counter: number): Uint8Array;
/** 新的配对密钥：16 字节 CSPRNG，按标准 base64 交出（24 字符）。每次配对都换（B7）。 */
export declare function generatePsk(): string;
/** host→client 方向的随机 nonce（Node 侧有 CSPRNG，小程序侧没有，所以只有这里用随机）。 */
export declare function randomNonce(): Uint8Array;
