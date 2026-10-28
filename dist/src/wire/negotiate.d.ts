/**
 * negotiate — 协议版本校验（**单版本**，2026-10-11 晚）。
 *
 * ## 为什么这一闸非有不可
 *
 * `hello.protocol` 对了才允许继续。不对的时候，这套协议的现场表现是
 * "连上了、界面正常、什么都不发生" —— 没有一层会报错，日志里也什么都没有。
 * 那是这套协议里最贵的一类故障，所以两端**必须**报版本，且必须与本端一致。
 *
 * ## ⚠️ 这里已经没有"协商"了
 *
 * 原来有两条为"三端发版节奏不同"准备的容忍路径：
 * - **V1**：对端不报版本就按 1 处理（"兼容既有小程序"）；
 * - **V3**：只要求对端落在 `[MIN_SUPPORTED_PROTOCOL, 本端]` 区间里。
 *
 * 没有老用户、三端同时发版 ⇒ 两条都删掉：**不报 = 拒，不等于本端 = 拒**。
 * 留下的唯一自由度是 `own` 可注入 —— 那是给判据造"版本对不上"用的，不是给线上用的。
 */
import { PROTOCOL_VERSION } from './frames.js';
export { PROTOCOL_VERSION };
/** 判定结果。`ok:false` 时 `message` 是**可以直接给用户看**的中文。 */
export type VersionVerdict = {
    ok: true;
    version: number;
} | {
    ok: false;
    reason: 'missing' | 'mismatch' | 'invalid';
    message: string;
    peer: unknown;
};
/**
 * 校验对端报的协议版本。
 *
 * 三条规则，逐条对应"说不清就拒"：
 * - **没报**（`undefined` / `null`）⇒ 拒：版本是必填字段，缺了说明对端不是这一版；
 * - **不是正整数** ⇒ 拒（`invalid`，与"版本不同"分开，排错方向不同）；
 * - **不等于本端** ⇒ 拒（`mismatch`）。
 */
export declare function negotiateProtocol(peerProtocol: unknown, own?: number): VersionVerdict;
/** 版本自述，用于日志与 `/api/info`。 */
export declare function describeVersion(): {
    protocol: number;
};
