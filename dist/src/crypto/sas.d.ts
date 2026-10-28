/**
 * 配对密钥交接（2026-10-21）：X25519 共享密钥 → 6 位 SAS + psk 包裹。
 *
 * 为什么需要这一层：微信可扫进小程序的只有**小程序码**，而 `scene` 只有 32 字符，
 * 装不下 44 字符的 psk；普通链接二维码对个人主体又直接关闭。
 * 所以 psk 不能跟着码走，只能由主机在**用户确认之后**单独送达。
 *
 * 三条设计约束（改之前先读 `docs/PAIRING-ONE-CODE.md`）：
 * 1. **中继不许拿到 psk**：这里出去的永远是 `secretbox(psk)` 密文，密钥由 X25519 协商，
 *    中继既没有私钥也没有共享密钥（D1 的前提不变）。
 * 2. **必须能发现中继换公钥**：两端各自用共享密钥算 6 位数字，人眼比对。
 *    中继若替换 `clientPub`/`hostPub`，两边算出的数字必然不同。
 * 3. **零新依赖**：只用 `tweetnacl`（两端都已有）。哈希用 `nacl.hash`（SHA-512），
 *    不做 HKDF —— 共享密钥本身已是均匀随机，这里只需要域分隔，不需要拉伸。
 */
import nacl from 'tweetnacl';
/**
 * 生成一次性密钥对。**每次配对都必须新生成**：复用会让上一次的 SAS 失去意义。
 */
export declare function newPairingKeyPair(): nacl.BoxKeyPair;
/**
 * 由「本方私钥 + 对方公钥」算出 32 字节共享密钥。两端各调一次，结果相同。
 *
 * 参数顺序刻意写成（私钥, 公钥）：`nacl.box.before` 自己的签名是
 * `(theirPublicKey, mySecretKey)`，而那个顺序在调用点上极容易写反 ——
 * 写反不会报错，只会算出两把不同的密钥（症状是 SAS 永远对不上）。
 */
export declare function deriveSharedKey(secretKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array;
/**
 * 6 位比对码（SAS）。
 *
 * 取 4 字节大端再对 1e6 取模：分布偏差约 1e-3 量级，对人眼比对这个用途足够；
 * 前导零必须补上（`012345` 与 `12345` 是两个不同的字符串，少一位用户就会以为看错）。
 */
export declare function sasCode(shared: Uint8Array): string;
/** 主机侧：把 psk 用共享密钥加密。中继只看得到这两个 base64 字段。 */
export declare function wrapPsk(shared: Uint8Array, psk: Uint8Array): {
    nonce: string;
    wrappedPsk: string;
};
/**
 * 手机侧：解出 psk。**任何异常都返回 null**（密文被换、base64 坏、密钥不对）。
 *
 * 返回 null 就是「这次配对作废」，调用方必须中止而不是拿空 key 继续 ——
 * 拿空 key 继续的表现是"连上了但什么都解不开"，比直接失败难查十倍。
 */
export declare function unwrapPsk(shared: Uint8Array, nonceB64: string, wrappedB64: string): Uint8Array | null;
