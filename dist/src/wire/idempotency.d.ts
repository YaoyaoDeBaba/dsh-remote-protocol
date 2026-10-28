/** 一次判定的结果。 */
export type IdempotencyDecision = 
/** 第一次见这条 cmdId：照常执行。 */
{
    action: 'execute';
}
/** 见过：MUST NOT 再执行一次，MUST 重发上一次那个 `ev.result`。 */
 | {
    action: 'replay';
    firstSeenAt: number;
}
/** 见过，但已经过了窗口：当作新命令执行（窗口是幂等的有效期，不是安全边界）。 */
 | {
    action: 'expired';
    firstSeenAt: number;
};
/**
 * 有界的 `cmdId` 台账。
 *
 * 用**插入序**而不是 Map 的遍历序做淘汰：`Map` 的插入序在重写同一个键时会保留原位，
 * 而"重写过"恰好意味着它是热键——把它按最旧淘汰会在高负载下丢掉热键。
 */
export declare class IdempotencyLedger {
    private readonly entries;
    private readonly windowMs;
    private readonly capacity;
    /**
     * 上次 `takeEvicted()` 之后被淘汰的键（缓冲在台账里，取走即清）。
     *
     * 为什么缓冲在这里而不在调用方扫表：本模块是**有界缓存**的实现方，
     * 只有它知道淘汰了谁；把"扫谁"这件事交给使用方，就等于让每个使用方各写一遍
     * O(n) 对齐逻辑（而漏掉一个就等于那张表无界）。见 {@link takeEvicted}。
     */
    private evicted;
    constructor(options?: {
        windowMs?: number;
        capacity?: number;
    });
    /**
     * 问一次，然后**就地记账**。
     *
     * 合成一个方法而不是 `has()` + `add()`：分开的写法里，进程若在两者之间退出
     * （或者调用方忘了调 `add`），命令就会被执行两次——而那正是本模块要防的事。
     */
    admit(cmdId: string, now: number): IdempotencyDecision;
    /** 只问不记（诊断与判据用）。 */
    has(cmdId: string, now: number): boolean;
    /**
     * 最近一次 `admit` / `prune` / `has` **淘汰掉**的那些 `cmdId`。
     *
     * ## 为什么需要这个出口
     *
     * 台账自己是**有界**的（窗口 + 容量两路淘汰），而它的使用方往往还并着
     * 一张按 `cmdId` 索引的表（典型形状：宿主侧缓存每条命令的 `ev.result`，
     * 好让重发能**重放**上一次那个回执而不是回一句新的）。
     *
     * 那张表不会自动跟着收缩：它调 `has(cmdId)` 只能问**自己那一个键**，
     * 而 `prune` 删的是台账的键。于是"台账稳在 256 条、外挂表长到进程寿命"——
     * 而症状不是内存涨一点，是每条回执还带着载荷（`cmd.list_sessions` 的回执
     * 带最多 100 条会话摘要）。
     *
     * 遍历整张外挂表来对齐是 O(n) **每条命令**，而 n 正是要解决的问题。
     * 正确的时机是"台账刚发生过结构性淘汰"时——而那正是这个出口提供的。
     *
     * 语义保证：
     * - 只含**本进程这个台账实例**淘汰掉的键，不含别处；
     * - 清空（`clear()`）也走这里，所以解配对时外挂表能一起收；
     * - 无淘汰时是**空数组**（不是 undefined），调用方不必判空。
     */
    takeEvicted(): string[];
    /** 当前台账里的条数。 */
    get size(): number;
    /** 清空（解配对时调用：那条通道的命令 id 不再有意义）。 */
    clear(): void;
    /** 丢掉窗口外的条目。 */
    prune(now: number): void;
    private insert;
}
/**
 * 命令去重的**窗口下界**：必须不小于 client 的最大重试间隔，
 * 否则"重发的那条"落在窗口外，于是它会被执行第二次。
 *
 * 做成一个函数而不是一个常量，是为了让调用方在算窗口时能引用它——
 * 规范 §10.2 I4 要求的是"≥"，而各端的重试间隔不是同一个数。
 */
export declare function minimumIdempotencyWindow(clientRetryIntervalMs: number): number;
