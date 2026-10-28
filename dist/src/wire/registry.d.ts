/**
 * registry — 协议注册表：帧名、载荷名、能力 id。
 *
 * ## 为什么要有这个文件
 *
 * 注册表本来是"协议知识"，但它曾经散在三处，每一处都要人肉同步：
 *
 * 1. zod 的两个判别联合（`endpointFrame` / `relayFrame`）——形状的事实源；
 * 2. 中继 `src/server.ts` 里手抄的 `KNOWN_FRAME_NAMES`——**手抄**的一份，用来把
 *    "帧名不认识"（`unknown_frame`）与"名字对、形状坏"（`bad_frame`）分开；
 *    （2026-10-07 已删：中继改 import 本文件的 `FRAME_TYPES` / `isKnownFrameType`。）
 * 3. 伞仓 `e2e/wire-surface.test.mjs` 靠正则从 `payloads.ts` 的**源码文本**里
 *    抽 `'ev.xxx'` / `'cmd.xxx'` 字面量。
 *
 * 三处同步意味着"协议加了帧、中继忘了改"不会编译失败、也不会测试变红，
 * 只是那个新帧在排错时永远收到一句 `unknown_frame`。本文件把 2 与 3 收进来：
 * 中继改 import 即可（删掉那份手抄），伞仓的闸门也能改成比对**导出的常量**
 * 而不是源码文本。
 *
 * ## 编译期保证"这张表与 union 完全一致"
 *
 * 表里多一个名字会怎样？union 解析时那个分支不可达，帧被静默拒收。
 * 表里少一个名字会怎样？那个帧被判成 `unknown_frame`，而对端明明在正确地发它。
 * 两种都是静默的。所以下面用 `_Assert<...>` 把它变成编译错误。
 */
import { type CmdPayload, type EvPayload } from './payloads.js';
import { type EndpointFrame, type RelayFrame } from './frames.js';
/** endpoint → relay 的帧名。 */
export declare const ENDPOINT_FRAME_TYPES: readonly EndpointFrame['t'][];
/** relay → endpoint 的帧名。 */
export declare const RELAY_FRAME_TYPES: readonly RelayFrame['t'][];
/**
 * 协议里存在过的全部控制帧名（两个方向的并集）。
 *
 * **去重**：enc / enc-batch / pair-grant 三个名字两个方向都有，直接相加会得到 23 个条目、20 个不同名字，
 * 而"注册表里有几条帧"这种问法本身就该按不同名字算——否则文档里的数字会骗人
 * （本项目已经吃过一次这种亏：README 里的"项数"漂了半年，见伞仓 HANDOFF §0.10.6）。
 */
export declare const FRAME_TYPES: readonly (EndpointFrame['t'] | RelayFrame['t'])[];
/**
 * 这个名字在协议里存在吗？（规范 §4.3.2 第 5 步）
 *
 * **只回答"名字"，不回答"形状"**——这两个必须分开，它们的错误码不同
 * （`unknown_frame` vs `bad_frame`），而它们对排错的价值完全不同：
 * 前者是"对端版本不对"，后者是"对端发了坏数据"。
 */
export declare function isKnownFrameType(name: unknown): name is EndpointFrame['t'] | RelayFrame['t'];
/**
 * 这一版中继**声明**的能力面（`hello-ok.capabilities`，PLAN-v5 M-C）。
 *
 * 方向是中继 → 端点：端点看见声明才启用新行为（"按声明开"）。清单与
 * 实现同进退 —— 中继实现了什么才声明什么，缺声明时端点一律按"老中继"处理。
 *   · `digest.v1` —— 状态摘要面（M2：主机发 `summary`、手机读 hello-ok.summary）。
 */
export declare const RELAY_CAPABILITIES: readonly ['digest.v1'];
/**
 * 通知面能力位（2026-10-27）。**动态能力**，故意**不在** `RELAY_CAPABILITIES` 里。
 *
 * ## 为什么它是动态的
 *
 * `RELAY_CAPABILITIES` 是"这一版中继**恒定**实现的面"。而通知面要
 * **appid + secret + 模板 id** 三样都配齐才启用 ⇒ 自部署的中继多半没配。
 *
 * ⇒ 声明了却发不出去，比**不声明**更坏：用户会看到开关、点下去没反应，
 * 那是"坏了"；不声明只是"没有这个功能"，那是"没开"。
 *
 * ⇒ 中继在 notifier 启用时**额外**声明这一条（见 relay/src/server.ts）。
 */
export declare const CAPABILITY_NOTIFY = "notify.v1";
/**
 * client → host 的全部命令名（规范 §17.2）。
 *
 * ⚠️ 结尾的 `as const satisfies` 不是风格问题，是下面那个 `_Assert` 能不能生效的**前提**。
 * 原来这里写的是 `: readonly CmdPayload['t'][]`——注解把类型**拓宽**成了"任意命令名数组"，
 * 于是 `(typeof CMD_TYPES)[number]` 就是 `CmdPayload['t']` 本身，
 * `Exclude<A, A>` 恒为 `never`，那条 `_Assert` **永远为真**（它看起来像一道编译期闸门，
 * 实际上一行代码都拦不住）。2026-10-08 加 `ev.host_info` 时漏登记 `EV_TYPES` 就是这么溜过去的，
 * 最后是**运行时**那条 `registry.test.ts` 抓到的。
 * `as const` 让元组保留字面量类型，`satisfies` 仍然检查每一项确实是合法的 t。
 */
export declare const CMD_TYPES: readonly ["cmd.send_prompt", "cmd.answer", "cmd.resolve_permission", "cmd.interrupt", "cmd.list_sessions", "cmd.keep_awake", "cmd.session_history", "cmd.new_session", "cmd.get_pending", "cmd.archive_session", "cmd.rename_session", "cmd.get_models", "cmd.set_model"];
/**
 * host → client 的全部事件名（规范 §17.3）。
 *
 * `as const satisfies` 的理由与 `CMD_TYPES` 逐字相同——不给 `as const`，
 * 下面那条 `_EvNamesMatchUnion` 就是一道永远为真的假闸门。
 */
export declare const EV_TYPES: readonly ["ev.session_changed", "ev.message_delta", "ev.tool_event", "ev.permission_request", "ev.permission_resolved", "ev.question_request", "ev.question_resolved", "ev.run_state", "ev.todo", "ev.retry", "ev.compaction", "ev.keep_awake_state", "ev.host_info", "ev.model", "ev.result", "ev.session_history"];
/** 这个 `t` 是协议里存在过的载荷名吗？（命令或事件都算） */
export declare function isKnownPayloadType(name: unknown): name is CmdPayload['t'] | EvPayload['t'];
/** 这个 `t` 是命令吗？ */
export declare function isCmdType(name: unknown): name is CmdPayload['t'];
/** 这个 `t` 是事件吗？ */
export declare function isEvType(name: unknown): name is EvPayload['t'];
/** 注册表自述。文档与闸门用它打印实测值，而不是各写一个数字（见 `scripts/report-gates.mjs`）。 */
export declare function describeCatalog(): {
    endpointFrames: number;
    relayFrames: number;
    frames: number;
    commands: number;
    events: number;
    payloads: number;
    errorCodes: number;
};
