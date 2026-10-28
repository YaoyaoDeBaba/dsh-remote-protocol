/**
 * outbound — 出站帧与出站载荷的**构造器**。
 *
 * 为什么要有这个文件（复核 R7、§5.2）：旧实现（以及我第一版新代码）都是在各处
 * 手搓 `{ t:'paired', sessionId, hostId }` 这样的字面量。这有两个后果：
 *
 * 1. 字段名散落在十几个调用点里，改一个就得改全部，而小程序只会**静默地**显示不出来；
 * 2. "禁止出现的字段"这种约束根本没有防线——比如 `ev.keep_awake_state` 与
 *    `ev.session_changed` 按契约**不带** `sessionId`（F11），但拼装模式下
 *    谁都可能顺手加一个，而 zod 默认会把未知键**剥掉**而不是报错，
 *    于是连测试都看不出差别。
 *
 * 这里把每条出站帧/载荷收成一个函数：参数表就是允许出现的字段集合，
 * 没有的参数**类型上不存在**。`outbound.test.mjs` 再对产物断言键集，
 * 这样 F4（必发帧的必填项）、F11（禁止字段）、F3（sessionId 逐字不变）
 * 才从"文档要求"变成"跑一下就红"。
 */
import { type EndpointFrame, type ErrorCode, type NotifyConfig, type NotifyItem, type RelayFrame, type StatusDigest } from './frames.js';
import { type ChoiceOption, type EvKeepAwakeState, type EvMessageDelta, type EvModel, type EvPermissionRequest, type EvPermissionResolved, type EvQuestionRequest, type EvQuestionResolved, type EvResult, type EvRunState, type EvSessionChanged, type EvTodo, type TodoItem, type EvRetry, type EvCompaction, type EvHostInfo, type EvSessionHistory, type EvToolEvent, type HistoryItem, type ModelOption, type QuestionItem, type SessionSummary } from './payloads.js';
export interface RelayOutbound {
    t: string;
    [key: string]: unknown;
}
/**
 * hello-ok 的可选下发面（M-C / M2）。
 *
 * `capabilities` 缺省 = `RELAY_CAPABILITIES` 全量（中继声明它实现的面）；
 * `summary` 只在会话条目上真有摘要时带上（M2 的回放面）。
 */
export interface HelloOkExtras {
    capabilities?: readonly string[];
    summary?: StatusDigest;
    /**
     * 通知面配置（2026-10-27）。**只有中继真的启用了 notifier 才带**。
     * 端点看见它才显示开关（老中继没这个字段 ⇒ 开关不出现）。
     */
    notify?: NotifyConfig;
}
export declare function helloOkForClient(clientId: string, protocol?: number, extras?: HelloOkExtras): RelayOutbound;
export declare function helloOkForHost(hostId: string, protocol?: number, extras?: HelloOkExtras): RelayOutbound;
/** 服务端权威 TTL。**ttlMs 必须是正整数**：主机要靠它改写本地过期时间（旧实现的第一起事故）。 */
export declare function pairReady(pairingToken: string, ttlMs: number): RelayOutbound;
export declare function paired(sessionId: string, hostId: string): RelayOutbound;
/**
 * 中继 → 主机：有人拿着一张码来认领，并带了一枚一次性公钥（2026-10-21）。
 *
 * 中继只做搬运：它不校验公钥是否"像真的"，也不参与密钥协商。
 */
export declare function pairRequest(pairingToken: string, clientPub: string, sessionId: string, hostId?: string): Extract<RelayFrame, {
    t: 'pair-request';
}>;
/**
 * 主机 → 中继 → 手机：psk 的密文（2026-10-21）。
 *
 * 带 `sessionId` 而不是 token：中继认领时就把 token 消费掉了，
 * 而主机在 `peer-joined` 里已经拿到会话号（见 frames.ts 里那段注释）。
 */
export declare function pairGrant(sessionId: string, hostPub: string, nonce: string, wrappedPsk: string): Extract<EndpointFrame, {
    t: 'pair-grant';
}>;
/**
 * `pair-fail`：**能带 token 就带**（2026-10-07 补）。
 *
 * 不带时主机侧只能作废"当前展示的那张"，而多码并存时那会作废错的那张
 * （详见 `frames.ts` 里 `pairFailFrame.pairingToken` 的注释）。
 * 缺省即不发这个字段：中继点不出名字时接线方按"当前展示的那张"兜底。
 */
export declare function pairFail(reason: 'invalid_or_expired' | 'already_used' | 'host_offline' | 'bad_token', pairingToken?: string): RelayOutbound;
/** 发给主机的加入通知必须带 pairingToken（主机按它取 PSK）；发给客户端的不带。 */
export declare function peerJoinedForHost(sessionId: string, clientId: string, pairingToken: string): RelayOutbound;
/**
 * `peer-left` 只有一个合法触发：**主机离开**。
 * 参数表里刻意没有"告诉某个客户端别人走了"的形态——那种帧会让别的手机无辜丢配对（F5）。
 */
export declare function peerLeft(sessionId: string, clientId: string, unpaired?: boolean): RelayOutbound;
/**
 * 构造一条错误帧。
 *
 * `retryAfterMs` 只给"等一等就好"的码（限流、表满）。规范 §12.2 E1 有一条硬要求：
 * 发给 **client** 的错误必须带中文 `message`——协议层管不了文案（那是部署方与产品的事），
 * 但它可以在这里把"带不带文案"变成一个签名上的选择：`message` 缺省时**不发这个字段**，
 * 于是调用方想省掉文案是一件显眼的事，而不是 `undefined` 悄悄被 JSON 丢掉。
 */
export declare function makeError(code: ErrorCode, message?: string, retryAfterMs?: number): RelayOutbound;
export declare function pong(ts?: number): RelayOutbound;
/**
 * `hello.resume` 补不出来时的回执（P1-3）。构造器守 schema 的 `reason` 值域 ——
 * 与 `makeError` 的 `retryAfterMs` 同一条纪律：造出一张对侧会静默丢掉的帧
 * 比抛错难查得多（小程序对认不出的帧名走 default 静默忽略）。
 */
export declare function resumeGap(sessionId: string, reason: 'overflow' | 'reset'): RelayOutbound;
/** 数据面：`sessionId` 逐字来自入帧或配对结果，这里不做任何加工（F3）。 */
export declare function encToClient(sessionId: string, seq: number, ciphertext: string): RelayOutbound;
export declare function encBatchToClient(sessionId: string, items: Array<{
    seq: number;
    ciphertext: string;
}>): RelayOutbound;
/**
 * 注册：host。
 *
 * **这个函数存在的原因**（2026-10-07）：宿主插件的七个出站控制帧全部是手写字面量
 * （`dsh-remote-control/packages/plugin/src/transport/relay.ts:230,273,301,356,392,433,623`），
 * 而**只有入站**帧过 `parseRelayFrameText`。于是给 `hello` / `enc` / `resync` 改字段
 * 对它没有任何编译期信号：中继收到了形状不对的帧，回一句 `bad_frame`，
 * 而插件这边一切正常。这是 F4 那条纪律（"参数表就是允许出现的字段集合"）的另一半，
 * 此前只对 payload 生效。
 *
 * `protocol` 恒为 `PROTOCOL_VERSION`（除非判据显式注入另一个值来造"版本对不上"）。
 */
export declare function helloForHost(args: {
    token?: string;
    hostId?: string;
    label?: string;
    protocol?: number;
    /**
     * 本端软件版本（2026-10-22）：**缺省就不带这个键**（不是带空串）。
     * 现状（2026-10-23 裁决后）：插件**无条件**上报、小程序上传时默认开（`DRC_REPORT_VERSION`
     * 只关不猜）、中继无条件记 —— 注释里的"默认不带"已是历史。
     */
    softwareVersion?: string;
}): EndpointFrame;
/**
 * 注册：client。
 *
 * `protocol` **必填**（单版本制）：这里恒写出来，不做"缺省就省掉"那种事。
 */
export declare function helloForClient(args: {
    clientId?: string;
    clientMeta?: {
        platform?: string;
        label?: string;
    };
    protocol?: number;
    /**
     * 本端软件版本（2026-10-22）：**缺省就不带这个键**（不是带空串）。
     * 现状（2026-10-23 裁决后）：插件**无条件**上报、小程序上传时默认开（`DRC_REPORT_VERSION`
     * 只关不猜）、中继无条件记 —— 注释里的"默认不带"已是历史。
     */
    softwareVersion?: string;
}): EndpointFrame;
/** host 发布一次性配对码（不含 PSK——D1 的执行点）。 */
export declare function pairBegin(pairingToken: string): EndpointFrame;
/**
 * client 认领配对码。小程序从不提交 PSK。
 *
 * `clientPub`（2026-10-21 加，schema 可选）：小程序码路线里手机拿不到 psk，
 * 认领时带一枚一次性 X25519 公钥，主机比对完 6 位确认码后用它把 psk 送回来。
 * 3.2 起所有客户端都带它；构造器留可选与 schema 同款（帧形状本身不依赖它）。
 * 参数表补上它是 2026-10-24 审计：此前公共 API 构造不出"今天每个客户端都发的帧"。
 */
export declare function pairClaim(pairingToken: string, clientPub?: string): EndpointFrame;
/**
 * 心跳。**生产路径不用它**（规范 §4.4：保活靠 WS 层 ping，应用层 ping 会周期性
 * 踢掉空闲客户端）。它在这里是为了让"插件自发探活那条路径"也有一个受 schema 约束的构造器，
 * 而不是像今天这样手写 `{t:'ping', ts}`。
 */
export declare function ping(ts?: number): EndpointFrame;
/**
 * endpoint → relay 的数据面帧。
 *
 * 与 `encToClient` 的唯一区别是方向命名，因为两边的**长度守门是同一条**：
 * 超过上限的密文会让对侧静默丢帧，而中继在转发前只看字符集、不看长度。
 *
 * ## `clientId` 为什么在这里（2026-10-07 补）
 *
 * schema 里的 `clientId` 是**中继转发时补的**：端点自己发的 `enc` 不带它，
 * 而中继把客户端的上行转给主机时要补上"这是哪台手机"（主机按它做 per-client 回调）。
 * 于是这个字段是**唯一一个"两端都不生产、只有中继生产"**的字段。
 *
 * 原先中继因此只能手写 `{t:'enc',…}` 字面量——那意味着 `sessionId` / `seq` /
 * `ciphertext` 三个字段名在协议层与中继各写一遍，改字段不会编译失败。
 * 参数表补上它之后那条手写路径就消失了。
 */
export declare function encToRelay(sessionId: string, seq: number | undefined, ciphertext: string, clientId?: string): EndpointFrame;
/**
 * 批量帧的**上行**方向：中继把客户端的批量帧原样转给主机。
 *
 * 与 `encBatchToClient` 不同，这里的 `seq` 是**可选**的（跟 schema 一致）：
 * 客户端发来的 items 本来就可能不带 seq，中继在转发这条上行时**不改它**——
 * 重新编号是中继→客户端方向独有的（`forwardEncBatch` 的下行分支）。
 * 所以参数表必须容得下 `seq` 缺失，否则中继只能手写字面量绕过它。
 */
export declare function encBatchToRelay(sessionId: string, items: ReadonlyArray<{
    seq?: number;
    ciphertext: string;
}>): EndpointFrame;
/**
 * 显式退出某个会话。
 *
 * `clientId` 可选且**只有 client 会带**：中继据此区分"这条 frame 的发送方是会话成员"
 * 与"host 作废了自己的会话"，两条路径给 `peer-left` 的触发完全不同（规范 §8.3）。
 */
export declare function sessionLeave(sessionId: string, clientId?: string): EndpointFrame;
/**
 * host → 中继：登记状态摘要（M2，REVIEW §5.1）。
 *
 * 摘要**不走 enc**（中继要存、手机回头要读），所以它是明文面 —— 形状防线
 * 在 `statusDigest`（strict：自由文本键整帧拒收）。这里只管原样装箱：
 * 构造器不加字段、不猜字段，schema 认得什么就是什么。
 */
export declare function summary(sessionId: string, digest: StatusDigest): EndpointFrame;
/**
 * host 声明"我此刻仍持有密钥的会话"（规范 §8.4）。
 *
 * 上限与 `resyncFrame` 的 `.max(2000)` 同源：一条超长的数组会让中继白占内存，
 * 而它对配对没有那么多条通道的要求。构造器在这里先挡一道，
 * 免得造出一条**自己收不了**的帧。
 */
/**
 * 小程序 → 中继：登记订阅。
 *
 * `subscribed: true` = 刚接受了一次订阅 ⇒ 额度 +1。
 * ⚠️ `code` 是**一次性 code**（`wx.login` 给的），中继拿它换 openid 之后就作废。
 */
export declare function notifyRegister(code: string, subscribed?: boolean): EndpointFrame;
/**
 * 主机 → 中继：这个会话里有待办，请按需发通知。
 *
 * `items` 是**同一会话里所有未通知的 pending**（审批 + 提问打包成一条）——
 * 一张卡一条通知会把用户的通知栏刷爆。
 */
export declare function notifyApproval(conversationId: string, items: readonly NotifyItem[]): EndpointFrame;
export declare function resync(sessionIds: readonly string[]): EndpointFrame;
export declare function sessionChanged(sessions: SessionSummary[], reason?: string): EvSessionChanged;
export declare function messageDelta(args: {
    messageId: string;
    delta: string;
    sessionId?: string;
    part?: number;
    role?: 'assistant' | 'user' | 'system';
    done?: boolean;
}): EvMessageDelta;
export declare function toolEvent(args: {
    callId: string;
    phase: 'started' | 'args' | 'completed' | 'failed';
    tool?: string;
    title?: string;
    argsPreview?: string;
    resultPreview?: string;
    sessionId?: string;
}): EvToolEvent;
export declare function permissionRequest(args: {
    requestId: string;
    action: string;
    options?: ChoiceOption[];
    resource?: string;
    reason?: string;
    expiresAt?: string;
    sessionId?: string;
}): EvPermissionRequest;
/**
 * 收回一张已经不必回答的审批卡（见 `evPermissionResolved` 的注释：桌面与手机同时被问，
 * 谁先答谁算，**输的那一侧要主动收**，不许让它对着一个已关闭的请求继续倒计时、继续可点）。
 */
export declare function permissionResolved(args: {
    requestId: string;
    /** 必填：收场必须精确到会话（见 `evPermissionResolved` 的字段注）。 */
    sessionId: string;
    by: 'desktop' | 'cancelled';
}): EvPermissionResolved;
export declare function questionRequest(args: {
    requestId: string;
    questions: QuestionItem[];
    expiresAt?: string;
    sessionId?: string;
}): EvQuestionRequest;
/**
 * 收回一张已经不必回答的提问卡（与 `permissionResolved` 同一条理由：两端同时问、
 * 谁先答谁算，输的那一侧要主动收）。
 *
 * 提问这张卡**本来没有任何倒计时**（`ev.question_request` 今天才补上 `expiresAt`），
 * 所以对它来说这一帧不是"提前收卡"，而是唯一一条能让它消失的路径之一。
 */
export declare function questionResolved(args: {
    requestId: string;
    /** 必填，理由同 `permissionResolved`。 */
    sessionId: string;
    by: 'desktop' | 'cancelled';
}): EvQuestionResolved;
export declare function runState(args: {
    state: 'running' | 'idle';
    detail?: string;
    sessionId?: string;
}): EvRunState;
/**
 * 待办清单（全量快照）。内核每次 `todo/write` 都给整份，所以这里也只发整份——
 * 增量（增删改某一条）在协议里没有形状，手机也不需要理解"改了哪条"。
 */
export declare function todoList(args: {
    todos: TodoItem[];
    sessionId?: string;
}): EvTodo;
/**
 * 模型重试。attempt/max/reason 三件套是**手机唯一用得上**的（见 payloads 里的注）。
 *
 * 为什么是这个形状：内核 `llm/retry` 的 data 里还有 policyKey 那段策略 JSON，
 * 对用户毫无意义，不出站；手机要拼的是"正在重试 2/5 · TRANSPORT"。
 */
export declare function retryNotice(args: {
    sessionId: string;
    attempt: number;
    max: number;
    reason?: string;
}): EvRetry;
/** 上下文压缩起止。state 三态别合并（failed 与 ended 对用户是两件事）。 */
export declare function compactionNotice(args: {
    sessionId: string;
    state: 'started' | 'ended' | 'failed';
    error?: string;
}): EvCompaction;
/**
 * 防休眠状态：参数表里没有 `sessionId`（F11）。
 * 想按会话区分就得改协议——那需要先改小程序，而它不在本次范围内。
 */
export declare function keepAwakeState(args: {
    enabled: boolean;
    active: boolean;
    platform: string;
    backend: string;
    reason?: string;
}): EvKeepAwakeState;
/**
 * 主机限额自述（§13.2）。**没有 `sessionId`**（F11）：限额是主机级的。
 *
 * ⚠️ 2026-10-11 晚：**能力位（`caps`）整条删掉**。它存在的唯一目的是让手机在
 * "对端可能不支持某个载荷"时降级（典型是 `drc.payload.resume` ⇒ 退回重拉一页）。
 * 三端同版本发版 ⇒ 没有"可能不支持"这回事，降级路径也就没有存在理由。
 */
export declare function hostInfo(args: {
    host: EvHostInfo['host'];
    limits: EvHostInfo['limits'];
    state: EvHostInfo['state'];
}): EvHostInfo;
/**
 * 当前模型。
 *
 * **`canSwitch` 必须由生产侧显式给出**，不许让手机从 `options` 有没有值去推断：
 * 「内核不能换」与「能换但清单为空」在手机上必须表现不同（置灰 vs 可点），
 * 推断出来的判断在"清单刚好为空"时会静默错成不可切。
 */
export declare function model(args: {
    sessionId: string;
    model: string;
    canSwitch: boolean;
    provider?: string;
    options?: ModelOption[];
    reason?: string;
}): EvModel;
export type EvResultExtras = {
    message?: string;
    data?: Record<string, unknown>;
};
export declare function result(cmdId: string, ok: boolean, extras?: EvResultExtras): EvResult;
/**
 * 一页历史。
 *
 * **只给游标，不给 `hasMore`**：`nextBeforeSeq` 在 = 还有更早的一页，不在 = 到底了。
 * 原来那版是两个字段，于是"说还有、却忘了给游标"能写得出来，而那产出的是一条
 * 过不了自己 schema 的载荷——它只会在手机侧被静默丢弃，表现是「加载更早」点了没反应。
 * 现在这种状态在类型上不存在。
 */
export declare function sessionHistory(args: {
    sessionId: string;
    cmdId: string;
    items: HistoryItem[];
    /** 省略即"这是最初的一页"。 */
    nextBeforeSeq?: number;
    /**
     * 这一页覆盖到的最大 seq（**空页也要给**，规范 §10.7 S3）。
     *
     * ⚠️ v3 加这个字段时只改了 schema，**漏了这个构造器**——于是 runtime 转发对了、
     * schema 也认了，而线格式那一步把它丢了。症状：手机收不到 `latestSeq`，
     * 下次重连只能记 0 ⇒ 整段历史重拉（而判据当时只查 schema 与 mock，
     * 正好从这两侧看不见这个洞）。**任何加字段的改动都要过一遍出站构造器。**
     */
    latestSeq?: number;
}): EvSessionHistory;
