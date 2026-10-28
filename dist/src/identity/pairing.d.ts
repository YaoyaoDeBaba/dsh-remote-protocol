/**
 * 6 位配对码（手输友好）。用 CSPRNG，不用 `Math.random()`。
 *
 * 这是**唯一**的配对凭据形状：屏幕上印的、中继 `pendingPairs` 里存的、手机上 scene 里带的，
 * 都是它。
 */
export declare function randomPairingToken(): string;
/**
 * 把整数摆成 6 位数字码。
 *
 * 非有限值（NaN / Infinity）**抛错**而不是返回 `'000NaN'`（2026-10-06 审计）：
 * 那个返回值不是 6 位数字码，扫进去永远配不上，而调用方以为拿到了一张合法的码。
 */
export declare function formatPairingToken(n: number): string;
