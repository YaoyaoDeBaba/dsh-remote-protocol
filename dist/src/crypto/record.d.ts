/** 密封记录。字段名冻结。 */
export interface SealedRecord {
    ciphertext: string;
}
/**
 * 密封一个可 JSON 序列化的载荷。
 *
 * nonce 可省略（Node 侧有 CSPRNG，默认随机）。小程序侧必须显式传计数器 nonce，
 * 那是它环境的限制，不是这里的——两边产出都是同一种记录。
 */
export declare function seal(key: Uint8Array, payload: unknown, nonce?: Uint8Array): SealedRecord;
/**
 * 打开一条记录。**任何失败都返回 null，绝不抛异常**（B3）。
 *
 * 为什么不抛：调用方拿到 null 之后的处置是「丢弃这一帧，或按计数判定配对已失效」，
 * 而抛异常会让一次损坏的帧打断整条消息处理链（小程序侧就是这么处理的，
 * 并且它给两次机会才丢配对——取证 legacy-spec/mp-client-contract.md §3.2）。
 */
export declare function open<T = unknown>(key: Uint8Array, record: unknown): T | null;
