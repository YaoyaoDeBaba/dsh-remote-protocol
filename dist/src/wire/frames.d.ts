/**
 * frames — 控制面（明文）帧。
 *
 * 这些帧是**中继唯一读得懂的东西**：它按 `t` 与几个标识字段做路由，
 * `ciphertext` 对它是不透明字符串（结构性零知识，docs/DESIGN.md §5.2）。
 *
 * 帧名冻结（F1）：`hello` `hello-ok` `pair-begin` `pair-ready` `pair-begin-client`
 * `paired` `pair-fail` `peer-joined` `peer-left` `enc` `enc-batch` `ping` `pong` `error`。
 * 新增名字是安全的（小程序的 `_onFrame` 把不认识的 `t` 落进 `default` 静默忽略）；
 * **挪用既有名字的语义不是**——比如把心跳响应叫 `peer-left`，
 * 小程序会每收到一次就丢一次配对。
 *
 * 与旧实现的三处结构差异（都不影响小程序，取证 docs/DESIGN.md §4、§8）：
 *
 * - **D5：`auth`/`auth-ok`/`auth-fail` 三帧并成一条 `hello` 注册路径。**
 *   旧的中继里，host 用 `auth`、client 用 `hello` 做同一件事（登记身份、拿回权威 id），
 *   失败面一个是 `auth-fail{reason}` 一个是 `error{code}`。合并后 host 发
 *   `hello{role:'host', token}`，失败统一 `error{code:'bad_token'}`。
 *   小程序仍只发它那一套（F2 的三种帧一个字节都没动）。
 * - **D1：`pair-begin` 不再携带 `psk`。** PSK 只留在主机本地，中继内存里不再有密钥副本。
 * - 删掉两个从未被使用的声明：`session-list` 帧、`cmd.subscribe` 载荷
 *   （前者中继从未发送/处理，后者的 `sessionIds`/`includeContent` 没有任何效果）。
 */
import { z } from 'zod';
import { MAX_CIPHERTEXT_BYTES, MAX_RELAY_MESSAGE_BYTES } from './limits.js';
/**
 * 帧大小预算住 `limits.ts`（三端共享的数值只有一个来源），这里**必须继续转出**：
 * 中继 `src/config.ts` 从 `@dsh-remote/protocol/frames` 引 `MAX_RELAY_MESSAGE_BYTES`
 * 当 `DRC_MAX_MSG_BYTES` 的默认值，撤掉这条转出是一个只会在下游编译期爆炸的变更。
 */
export { MAX_CIPHERTEXT_BYTES, MAX_RELAY_MESSAGE_BYTES };
/** 协议版本。三端同版本发版，**必填**；不等于本端时中继当场拒掉（见 `negotiate.ts`）。 */
export declare const PROTOCOL_VERSION = 1;
/** 6 位配对码。位数变了要同时动三处（中继校验、主机生成、小程序归一化），而小程序改不了。 */
export declare const PAIRING_TOKEN_RE: RegExp;
/**
 * 密文记录的合法性预检。
 *
 * 为什么必须显式写：`Buffer.from(s,'base64')` 对非法字符是**静默丢弃并继续**，
 * 于是"手机能发、主机报错"这类假故障就没有落点。中继在转发前按标准表校验一次
 * （含 `+` `/` `=`，不含 url-safe 表），错的就直接 `bad_frame` 拒掉——
 * 这也是 D4 之外中继唯一会碰载荷内容的地方，而它碰的只是**字符集**，不是明文。
 */
export declare const base64Text: z.ZodString;
declare const clientMeta: z.ZodObject<{
    platform: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 客户端自报的门面信息（小程序发 `{platform:'wechat-mp', label:'微信小程序'}`）。 */
export type ClientMeta = z.infer<typeof clientMeta>;
/** host 与 client 共用这一条注册帧；`token` 只有 host 会带。 */
export declare const helloFrame: z.ZodObject<{
    t: z.ZodLiteral<"hello">;
    role: z.ZodEnum<{
        client: "client";
        host: "host";
    }>;
    protocol: z.ZodNumber;
    token: z.ZodOptional<z.ZodString>;
    hostId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    clientMeta: z.ZodOptional<z.ZodObject<{
        platform: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    softwareVersion: z.ZodOptional<z.ZodString>;
    resume: z.ZodOptional<z.ZodObject<{
        sessionId: z.ZodString;
        fromSeq: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** 主机发布一次性配对码。**没有 psk 字段**——这是 D1 的执行点。 */
export declare const pairBeginFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-begin">;
    pairingToken: z.ZodString;
}, z.core.$strip>;
/**
 * 客户端认领配对码。小程序从不提交 PSK。
 *
 * `clientPub`（2026-10-21 加，**可选**）：小程序码路线里手机拿不到 psk，
 * 得在这里带一枚一次性 X25519 公钥，主机确认后再把 psk 加密送回来。
 * 3.2 起所有客户端都带它；可选只是为了让 `pair-begin-client` 这个帧形状本身不依赖它
 * （不带时中继照常把认领转给主机，只是不会收到 `pair-request`）。
 */
export declare const pairClaimFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-begin-client">;
    pairingToken: z.ZodString;
    clientPub: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 中继 → 主机：有人拿 publicKeyB64 来认领这张码（2026-10-21）。
 *
 * 中继只是**转发**：它把 `pair-begin-client` 里的 `clientPub` 原样带给主机。
 * 中继不知道 psk，也不知道主机将回什么。
 */
export declare const pairRequestFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-request">;
    pairingToken: z.ZodString;
    clientPub: z.ZodString;
    sessionId: z.ZodString;
    hostId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 主机 → 中继 → 手机：psk 的密文（2026-10-21）。
 *
 * 三个字段都是中继眼里的**不透明字节**：`hostPub` 是主机的临时公钥，
 * `nonce` + `wrappedPsk` 是 `secretbox(psk)`。中继只负责转交。
 */
export declare const pairGrantFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-grant">;
    sessionId: z.ZodString;
    hostPub: z.ZodString;
    nonce: z.ZodString;
    wrappedPsk: z.ZodString;
}, z.core.$strip>;
export declare const encFrame: z.ZodObject<{
    t: z.ZodLiteral<"enc">;
    sessionId: z.ZodString;
    seq: z.ZodOptional<z.ZodNumber>;
    clientId: z.ZodOptional<z.ZodString>;
    ciphertext: z.ZodString;
}, z.core.$strip>;
export declare const encBatchFrame: z.ZodObject<{
    t: z.ZodLiteral<"enc-batch">;
    sessionId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        seq: z.ZodOptional<z.ZodNumber>;
        ciphertext: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** 显式退出某个会话（D3 之后会话会长存，需要一条主动退出的路）。 */
export declare const sessionLeaveFrame: z.ZodObject<{
    t: z.ZodLiteral<"session-leave">;
    sessionId: z.ZodString;
}, z.core.$strip>;
/**
 * **状态摘要**（M2，REVIEW-offline-continuity §5.1）——零知识边界上唯一的明文业务面。
 *
 * 零知识切分（§5.1 原文）：「**内容**零知识（中继不可解密）＋ **状态**可留存
 * （最后活动时间 / 进度摘要 / 待审批数）」。正因为它不走 enc（中继要存、
 * 手机回头要读），**形状就是防线**：
 *
 *   · 只许状态类字段 —— 时刻（at）/ 布尔（running）/ 非负整数（steps、pending）；
 *   · **一个自由文本都不许有**（title/detail/content…）——§5.1 风险条：
 *     「摘要粒度要克制（不写具体任务文本）」，自由文本一进来就是内容侧漏；
 *   · `strict()` 是执行点：多带一个键 ⇒ **整帧拒收**（bad_frame），
 *     不是静默剥掉 —— 静默剥掉是"主机以为存上了、其实没有"，
 *     而拒收会当场出声（判据：tests/wire/summary.test.ts 的 strict 反证那条）。
 */
export declare const statusDigest: z.ZodObject<{
    at: z.ZodNumber;
    running: z.ZodBoolean;
    steps: z.ZodOptional<z.ZodNumber>;
    pending: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type StatusDigest = z.infer<typeof statusDigest>;
/** 主机 → 中继：把状态摘要登记到会话条目上（中继持久化它，见 relay/persist）。 */
export declare const summaryFrame: z.ZodObject<{
    t: z.ZodLiteral<"summary">;
    sessionId: z.ZodString;
    summary: z.ZodObject<{
        at: z.ZodNumber;
        running: z.ZodBoolean;
        steps: z.ZodOptional<z.ZodNumber>;
        pending: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strip>;
export declare const pingFrame: z.ZodObject<{
    t: z.ZodLiteral<"ping">;
    ts: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * 主机声明"我此刻仍持有密钥的会话有哪些"。
 *
 * 为什么必须有这条（复核 R1）：D3/D6 让会话跨断连存活之后，出现了旧实现没有的
 * 死角——**主机进程重启**（PSK 随之消失）而中继不知道，于是它继续把手机发来的
 * 密文转发给一个解不开的主机；手机既收不到回复、也收不到 `unknown_session`，
 * 表现是"永远转圈且没有任何提示"。中继自己的表命中与否并不能代表主机是否还认得这个会话。
 *
 * 语义：主机鉴权成功后立刻发一条 `resync`，列出它还持有的 convId。
 * 中继把该主机名下**没被列出**的会话删掉，但**不**向客户端发 `peer-left`——
 * 那在小程序里会翻成一条英文 toast（没有映射），而是让客户端下一次用旧 convId
 * 发帧时自然撞上 `unknown_session`，从而得到中文的"会话已失效，请重新配对"。
 */
export declare const resyncFrame: z.ZodObject<{
    t: z.ZodLiteral<"resync">;
    sessionIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/** 端点可能发给中继的一切。 */
/** 模板 id 的上限（微信的模板 id 是 43 字符，留一倍余量）。 */
export declare const NOTIFY_TEMPLATE_ID_MAX = 128;
/**
 * 中继下发的通知配置（`hello-ok.notify`）。
 *
 * **客户端看见它才显示开关** —— 老中继没有这个字段，开关不出现。
 * 模板 id 由中继下发：避免小程序包里和部署配置各写一份（写两份迟早对不上）。
 */
export declare const notifyConfig: z.ZodObject<{
    templateId: z.ZodString;
}, z.core.$strict>;
export type NotifyConfig = z.infer<typeof notifyConfig>;
/**
 * 一条待办的通知条目。**strict** —— 它是要落进"已发过"集合的形状，
 * 坏形状整条拒收（与 `statusDigest` 同一条纪律：静默剥键会让人以为那条还在）。
 */
export declare const notifyItem: z.ZodObject<{
    requestId: z.ZodString;
    sessionId: z.ZodString;
    kind: z.ZodEnum<{
        approval: "approval";
        question: "question";
    }>;
    askedAt: z.ZodString;
}, z.core.$strict>;
export type NotifyItem = z.infer<typeof notifyItem>;
/**
 * 小程序 → 中继：登记订阅。
 *
 * `code` 是 `wx.login` 的一次性 code，中继用它换 openid。
 * ⚠️ **它是一份凭据**：只用于一次换取，不写日志、不落盘。
 */
export declare const notifyRegisterFrame: z.ZodObject<{
    t: z.ZodLiteral<"notify-register">;
    code: z.ZodString;
    subscribed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * 主机 → 中继：这个会话里有待办，请按需发通知。
 *
 * `items` 1–10 条：同一会话里所有未通知的 pending 打包成一条，
 * 避免"一张卡一条通知"把用户的通知栏刷爆。
 */
export declare const notifyApprovalFrame: z.ZodObject<{
    t: z.ZodLiteral<"notify-approval">;
    conversationId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        requestId: z.ZodString;
        sessionId: z.ZodString;
        kind: z.ZodEnum<{
            approval: "approval";
            question: "question";
        }>;
        askedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strip>;
export declare const endpointFrame: z.ZodDiscriminatedUnion<[z.ZodObject<{
    t: z.ZodLiteral<"hello">;
    role: z.ZodEnum<{
        client: "client";
        host: "host";
    }>;
    protocol: z.ZodNumber;
    token: z.ZodOptional<z.ZodString>;
    hostId: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    clientMeta: z.ZodOptional<z.ZodObject<{
        platform: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    softwareVersion: z.ZodOptional<z.ZodString>;
    resume: z.ZodOptional<z.ZodObject<{
        sessionId: z.ZodString;
        fromSeq: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-begin">;
    pairingToken: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-begin-client">;
    pairingToken: z.ZodString;
    clientPub: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-grant">;
    sessionId: z.ZodString;
    hostPub: z.ZodString;
    nonce: z.ZodString;
    wrappedPsk: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"resync">;
    sessionIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"enc">;
    sessionId: z.ZodString;
    seq: z.ZodOptional<z.ZodNumber>;
    clientId: z.ZodOptional<z.ZodString>;
    ciphertext: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"enc-batch">;
    sessionId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        seq: z.ZodOptional<z.ZodNumber>;
        ciphertext: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"session-leave">;
    sessionId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"summary">;
    sessionId: z.ZodString;
    summary: z.ZodObject<{
        at: z.ZodNumber;
        running: z.ZodBoolean;
        steps: z.ZodOptional<z.ZodNumber>;
        pending: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ping">;
    ts: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"notify-register">;
    code: z.ZodString;
    subscribed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"notify-approval">;
    conversationId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        requestId: z.ZodString;
        sessionId: z.ZodString;
        kind: z.ZodEnum<{
            approval: "approval";
            question: "question";
        }>;
        askedAt: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strip>], "t">;
export type EndpointFrame = z.infer<typeof endpointFrame>;
export declare const helloOkFrame: z.ZodObject<{
    t: z.ZodLiteral<"hello-ok">;
    role: z.ZodEnum<{
        client: "client";
        host: "host";
    }>;
    clientId: z.ZodOptional<z.ZodString>;
    hostId: z.ZodOptional<z.ZodString>;
    protocol: z.ZodNumber;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
    summary: z.ZodOptional<z.ZodObject<{
        at: z.ZodNumber;
        running: z.ZodBoolean;
        steps: z.ZodOptional<z.ZodNumber>;
        pending: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    notify: z.ZodOptional<z.ZodObject<{
        templateId: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strip>;
/**
 * hello-ok 的声明里有这个面吗（M-C "按声明开"的执行点）。
 *
 * 输入不校验形状：`undefined` / 非数组 / 带怪名字都只回答"没有"，
 * **不抛不拒帧** —— 未来的中继多声明新面时，老端点必须安静地跳过。
 */
export declare function supportsCapability(capabilities: unknown, id: string): boolean;
/** 服务端权威 TTL。**主机必须据此改写本地过期时间**——这是旧实现的第一起事故。 */
export declare const pairReadyFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-ready">;
    pairingToken: z.ZodString;
    ttlMs: z.ZodNumber;
}, z.core.$strip>;
export declare const pairedFrame: z.ZodObject<{
    t: z.ZodLiteral<"paired">;
    sessionId: z.ZodString;
    hostId: z.ZodString;
}, z.core.$strip>;
/** 四个 reason 是 UI 分支条件，小程序有逐字的中文映射表（F6）。 */
export declare const pairFailFrame: z.ZodObject<{
    t: z.ZodLiteral<"pair-fail">;
    reason: z.ZodEnum<{
        already_used: "already_used";
        bad_token: "bad_token";
        host_offline: "host_offline";
        invalid_or_expired: "invalid_or_expired";
    }>;
    pairingToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const peerJoinedFrame: z.ZodObject<{
    t: z.ZodLiteral<"peer-joined">;
    sessionId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    pairingToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 对客户端而言，`peer-left` 只有一个合法触发：**主机离开**（D3 把这条写死）。 */
export declare const peerLeftFrame: z.ZodObject<{
    t: z.ZodLiteral<"peer-left">;
    sessionId: z.ZodString;
    clientId: z.ZodString;
    unpaired: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const errorCodes: readonly ['bad_role', 'bad_token', 'need_host', 'need_client', 'bad_pair', 'pair_table_full', 
/** 客户端靠这个字面量决定"清配对并提示重扫"（F5）。 */
'unknown_session', 
/** D4：发送方不是该会话成员。 */
'not_member', 
/**
 * 会话还在，但主机此刻不在（宽限期内）。**必须区别于 `unknown_session`**：
 * 客户端见到 `unknown_session` 会丢掉配对并要求重新扫码，而这里只是"这条指令没人接"，
 * 用户重试即可，配对关系不该因此作废（D3/D6）。
 */
'host_unavailable', 'bad_frame', 'rate_limited', 'bad_json', 'unknown_frame', 
/**
 * `cmd.session_history.since` 落在主机的保留窗口之外（V3-PLAN §5.1）。
 *
 * **它必须是一个明确的码，而不是"少给几条"**：主机只保留最近 N 条 seq，
 * 而手机记的 `since` 可能比那更早（长时间离线）。此时若静默从窗口头部开始给，
 * 手机会以为补齐了，实际中间缺一段——而那段永远补不回来。
 *
 * ⚠️ **不可重试**：重发同一条 `since` 仍然是窗口外。客户端该做的是**改拉历史**
 * （退回 v2 的重拉一页），这也是它不在 `RETRYABLE` 里的原因。
 */
'history_window_exceeded', 
/**
 * 对端报的协议版本与本端**不相等**（含没报，规范 §5.2 V3）。
 *
 * 为什么不复用 `bad_frame`：它是**版本问题**而不是形状问题，而它唯一该触发的
 * 动作是"把版本说清楚"——一句"帧形状非法"会让用户去查一个根本不存在的问题。
 * 不认识的码在客户端会走兜底展示（`message || code`），所以中继 MUST 同时带上一句
 * 中文 message（规范 §12.3 E1）—— 反过来，"没带 message"就是把英文码弹给用户。
 */
'unsupported_protocol', 'internal'];
export declare const errorFrame: z.ZodObject<{
    t: z.ZodLiteral<"error">;
    code: z.ZodEnum<{
        bad_frame: "bad_frame";
        bad_json: "bad_json";
        bad_pair: "bad_pair";
        bad_role: "bad_role";
        bad_token: "bad_token";
        history_window_exceeded: "history_window_exceeded";
        host_unavailable: "host_unavailable";
        internal: "internal";
        need_client: "need_client";
        need_host: "need_host";
        not_member: "not_member";
        pair_table_full: "pair_table_full";
        rate_limited: "rate_limited";
        unknown_frame: "unknown_frame";
        unknown_session: "unknown_session";
        unsupported_protocol: "unsupported_protocol";
    }>;
    message: z.ZodOptional<z.ZodString>;
    retryAfterMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ErrorCode = z.infer<typeof errorFrame>['code'];
export declare const pongFrame: z.ZodObject<{
    t: z.ZodLiteral<"pong">;
    ts: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * `hello.resume` 补不出来的回执（P1-3，2026-10-22）：环形缓冲滚过了要补的那段，
 * 或者序号对不上 —— **明说缺了**，而不是悄悄少发几帧。
 *
 * 客户端收到它什么都不用做：缺帧的内容由既有的"重建显示"路径兜底
 * （`status` 回 online 后 chat 页的 `_tryLoadDelta`/`_loadHistory`），
 * 它只是把"这是一段缺口"从静默变成可判据、可计数的事件。
 * 真没有缺口时中继**不发**这一帧（回放几帧就是几帧，零帧就什么都不发）。
 *
 * ⚠️ reason 只有两个值：`overflow`（环滚过/中继重启丢了环）与 `reset`
 * （客户端游标跑到了计数器前面 —— 会话被重建过或 state 被手改过）。
 * 会话不存在/不是成员**不走这一帧**：那条路已经有 `unknown_session` 错误码
 * （F5 唯一清配对信号），多一个入口只会多一类"两条路说法不一致"的故障。
 */
export declare const resumeGapFrame: z.ZodObject<{
    t: z.ZodLiteral<"resume-gap">;
    sessionId: z.ZodString;
    reason: z.ZodEnum<{
        overflow: "overflow";
        reset: "reset";
    }>;
}, z.core.$strip>;
/** 中继可能发给端点的一切。 */
export declare const relayFrame: z.ZodDiscriminatedUnion<[z.ZodObject<{
    t: z.ZodLiteral<"hello-ok">;
    role: z.ZodEnum<{
        client: "client";
        host: "host";
    }>;
    clientId: z.ZodOptional<z.ZodString>;
    hostId: z.ZodOptional<z.ZodString>;
    protocol: z.ZodNumber;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodString>>;
    summary: z.ZodOptional<z.ZodObject<{
        at: z.ZodNumber;
        running: z.ZodBoolean;
        steps: z.ZodOptional<z.ZodNumber>;
        pending: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    notify: z.ZodOptional<z.ZodObject<{
        templateId: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-ready">;
    pairingToken: z.ZodString;
    ttlMs: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-request">;
    pairingToken: z.ZodString;
    clientPub: z.ZodString;
    sessionId: z.ZodString;
    hostId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-grant">;
    sessionId: z.ZodString;
    hostPub: z.ZodString;
    nonce: z.ZodString;
    wrappedPsk: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"paired">;
    sessionId: z.ZodString;
    hostId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pair-fail">;
    reason: z.ZodEnum<{
        already_used: "already_used";
        bad_token: "bad_token";
        host_offline: "host_offline";
        invalid_or_expired: "invalid_or_expired";
    }>;
    pairingToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"peer-joined">;
    sessionId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    pairingToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"peer-left">;
    sessionId: z.ZodString;
    clientId: z.ZodString;
    unpaired: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"error">;
    code: z.ZodEnum<{
        bad_frame: "bad_frame";
        bad_json: "bad_json";
        bad_pair: "bad_pair";
        bad_role: "bad_role";
        bad_token: "bad_token";
        history_window_exceeded: "history_window_exceeded";
        host_unavailable: "host_unavailable";
        internal: "internal";
        need_client: "need_client";
        need_host: "need_host";
        not_member: "not_member";
        pair_table_full: "pair_table_full";
        rate_limited: "rate_limited";
        unknown_frame: "unknown_frame";
        unknown_session: "unknown_session";
        unsupported_protocol: "unsupported_protocol";
    }>;
    message: z.ZodOptional<z.ZodString>;
    retryAfterMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"pong">;
    ts: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"enc">;
    sessionId: z.ZodString;
    seq: z.ZodOptional<z.ZodNumber>;
    clientId: z.ZodOptional<z.ZodString>;
    ciphertext: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"enc-batch">;
    sessionId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        seq: z.ZodOptional<z.ZodNumber>;
        ciphertext: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"resume-gap">;
    sessionId: z.ZodString;
    reason: z.ZodEnum<{
        overflow: "overflow";
        reset: "reset";
    }>;
}, z.core.$strip>], "t">;
export type RelayFrame = z.infer<typeof relayFrame>;
/** 中继解析端点来帧。`t` 认不出 → null（调用方回 `unknown_frame`）。 */
export declare function parseEndpointFrame(value: unknown): EndpointFrame | null;
/** 端点（主机或小程序）解析中继来帧。 */
export declare function parseRelayFrame(value: unknown): RelayFrame | null;
/** JSON 文本 → 对象 → 中继来帧；任何一步失败都 null（小程序侧同样静默丢弃非法帧）。 */
export declare function parseRelayFrameText(raw: string): RelayFrame | null;
