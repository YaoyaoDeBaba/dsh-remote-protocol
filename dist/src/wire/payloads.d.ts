/**
 * payloads — 数据面载荷目录（host ⇄ client，端到端加密之后才是这些）。
 *
 * 新实现里载荷类型的**唯一事实源**：中继看不见它们（结构性零知识），
 * 插件按 `cmd.*` 分发、按 `ev.*` 推送，小程序按字段名渲染。
 * 校验用 `zod`（选型依据是实测，不是口味：闭包 1 个包、0 运行时依赖、
 * 2.2M ops/s，而中继自己的帧速率上限是 500/s —— 见
 * `docs/legacy-spec/open-source-options.md` §A.5.1 与 §C）。
 *
 * 三个最容易出事的地方，钉在 schema 里而不是散落在各层：
 *
 * 1. **两个 `sessionId` 不是一回事**（F3）。中继帧外层的 `sessionId` 是配对通道 id
 *    （`c_xxx`）；载荷里的 `sessionId` 是 DSH 会话 id，且必须与 `sessions[].id` 同名同值。
 *    混淆它 = 聊天页把所有事件过滤掉，是本协议最贵的一类 bug。
 * 2. `ev.session_changed` 与 `ev.keep_awake_state` **不带** `sessionId`，将来也不许加
 *    （加了会被聊天页当作"别的会话"丢弃，F11）。
 * 3. `SessionSummary.updatedAt` 只能是 ISO-8601 字符串或不下发；给数字时间戳会让小程序
 *    整页渲染抛错，而那个异常被它的 `emit()` 吞掉，表现是"会话列表静默地不更新"（F7）。
 *    这条在**生产端**兜住：`isoOrUndefined()`（见文件末尾）——不要指望校验器替你决定
 *    "数字时间戳该不该发"。
 *
 * 一处刻意的宽松：未知字段被 zod 剥掉。载荷的**生产者是我们自己的 host**，
 * 消费者是手机；插件不会因为不认识某个字段而坏，所以剥未知字段只带来一个好处——
 * 不会把对端多塞的东西原样转发到手机上。
 */
import { z } from 'zod';
/** 会话状态枚举。拼错一个字符，手机端徽标会退化成"空闲"——归档会话因此看着像正常会话。 */
export declare const SESSION_STATES: readonly ['idle', 'running', 'detached', 'archived', 'awaiting-permission', 'awaiting-answer'];
declare const sessionSummary: z.ZodObject<{
    id: z.ZodString;
    state: z.ZodOptional<z.ZodEnum<{
        archived: "archived";
        "awaiting-answer": "awaiting-answer";
        "awaiting-permission": "awaiting-permission";
        detached: "detached";
        idle: "idle";
        running: "running";
    }>>;
    running: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    workspace: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    origin: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 会话摘要。 */
export type SessionSummary = z.infer<typeof sessionSummary>;
export declare const evSessionChanged: z.ZodObject<{
    t: z.ZodLiteral<"ev.session_changed">;
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        state: z.ZodOptional<z.ZodEnum<{
            archived: "archived";
            "awaiting-answer": "awaiting-answer";
            "awaiting-permission": "awaiting-permission";
            detached: "detached";
            idle: "idle";
            running: "running";
        }>>;
        running: z.ZodOptional<z.ZodBoolean>;
        title: z.ZodOptional<z.ZodString>;
        workspace: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodString>;
        origin: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const evMessageDelta: z.ZodObject<{
    t: z.ZodLiteral<"ev.message_delta">;
    sessionId: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    part: z.ZodOptional<z.ZodNumber>;
    delta: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        assistant: "assistant";
        system: "system";
        user: "user";
    }>>;
    done: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
declare const choiceOption: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, z.core.$strip>;
/** 一个可选项；`id` 会被手机逐字回传，所以它必须是稳定的机器名。 */
export type ChoiceOption = z.infer<typeof choiceOption>;
export declare const evToolEvent: z.ZodObject<{
    t: z.ZodLiteral<"ev.tool_event">;
    sessionId: z.ZodOptional<z.ZodString>;
    callId: z.ZodString;
    tool: z.ZodOptional<z.ZodString>;
    phase: z.ZodEnum<{
        args: "args";
        completed: "completed";
        failed: "failed";
        started: "started";
    }>;
    title: z.ZodOptional<z.ZodString>;
    argsPreview: z.ZodOptional<z.ZodString>;
    resultPreview: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const evPermissionRequest: z.ZodObject<{
    t: z.ZodLiteral<"ev.permission_request">;
    sessionId: z.ZodOptional<z.ZodString>;
    requestId: z.ZodString;
    action: z.ZodString;
    resource: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, z.core.$strip>>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 「这张审批卡不用答了」——桌面那一位先答了，或者这次请求本身被撤回。
 *
 * 为什么必须有：主机现在**同时**问桌面和手机（谁先答谁算，插件不许改变宿主自己的行为）。
 * 手机先答时，桌面那张会留到这次工具调用的生命周期结束——那是宿主自己的 `signal` 在收尾，
 * 插件碰不到，只能接受；但**反过来不能靠手机自己超时**：桌面上有人点了之后，
 * 手机那张卡的倒计时还在走、按钮还能点，点下去是对着一个已经关闭的请求做写操作。
 * 所以输的那一侧必须被明确收回。
 */
export declare const evPermissionResolved: z.ZodObject<{
    t: z.ZodLiteral<"ev.permission_resolved">;
    requestId: z.ZodString;
    sessionId: z.ZodString;
    by: z.ZodEnum<{
        cancelled: "cancelled";
        desktop: "desktop";
    }>;
}, z.core.$strip>;
declare const questionItem: z.ZodObject<{
    id: z.ZodString;
    question: z.ZodString;
    multi: z.ZodOptional<z.ZodBoolean>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** 提问卡里的一道题；`id` 是回传时 `answers[].questionId` 的值。 */
export type QuestionItem = z.infer<typeof questionItem>;
export declare const evQuestionRequest: z.ZodObject<{
    t: z.ZodLiteral<"ev.question_request">;
    sessionId: z.ZodOptional<z.ZodString>;
    requestId: z.ZodString;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        question: z.ZodString;
        multi: z.ZodOptional<z.ZodBoolean>;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 「这张提问卡不用答了」——桌面那一位先答了，或者这次请求本身被撤回/超时。
 *
 * 与 `ev.permission_resolved` 同一条理由：提问现在也是**两端同时问、谁先答谁算**，
 * 输的那一侧必须被明确收回，不能靠手机自己那张没有倒计时的卡一直挂着。
 */
export declare const evQuestionResolved: z.ZodObject<{
    t: z.ZodLiteral<"ev.question_resolved">;
    requestId: z.ZodString;
    sessionId: z.ZodString;
    by: z.ZodEnum<{
        cancelled: "cancelled";
        desktop: "desktop";
    }>;
}, z.core.$strip>;
export declare const evRunState: z.ZodObject<{
    t: z.ZodLiteral<"ev.run_state">;
    sessionId: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<{
        idle: "idle";
        running: "running";
    }>;
    detail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 一条待办。与内核 `todo/write` 的 `TodoItem` 一一对应——整条原样转发，小程序不猜。 */
declare const todoItem: z.ZodObject<{
    content: z.ZodString;
    status: z.ZodEnum<{
        completed: "completed";
        in_progress: "in_progress";
        pending: "pending";
    }>;
}, z.core.$strip>;
/** 待办清单。 */
export type TodoItem = z.infer<typeof todoItem>;
export type EvCompaction = z.infer<typeof evCompaction>;
export type EvRetry = z.infer<typeof evRetry>;
/**
 * 会话当前的待办清单（**全量快照**，与内核 `todo/write` 同语义）。
 *
 * 为什么放在顶上一颗常驻条里、默认收起：它是"这一轮在干什么"的索引，不是正文——
 * 混进消息流会和堆栈帧互相踩（用户 2026-10-05 点的就是做在顶部、别和排队消息打架）。
 */
/**
 * 模型正在重试（host - client，2026-10-06）。
 *
 * 真机取证：内核 \`llm/retry\` 的 data 带 retry / maxRetries / failure，
 * 而插件一直没有映射它——手机上模型卡住时一片空白，用户以为它死了，
 * 实际是宿主正在重试。这条只带**够拼出人话**的字段：第几次、共几次、什么原因。
 * \`policyKey\` 那段策略 JSON 对用户毫无意义，不出站。
 */
export declare const evRetry: z.ZodObject<{
    t: z.ZodLiteral<"ev.retry">;
    sessionId: z.ZodString;
    attempt: z.ZodNumber;
    max: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 上下文压缩的起止（host - client，2026-10-06）。
 *
 * \`state='failed'\` 与 \`ended\` 是两件事：前者是“压缩没成”，真机见过
 * \`summarization produced no text summary content\`。合并成一个 ended 会让用户
 * 在上下文已经烂掉的情况下以为一切正常。
 */
export declare const evCompaction: z.ZodObject<{
    t: z.ZodLiteral<"ev.compaction">;
    sessionId: z.ZodString;
    state: z.ZodEnum<{
        ended: "ended";
        failed: "failed";
        started: "started";
    }>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const evTodo: z.ZodObject<{
    t: z.ZodLiteral<"ev.todo">;
    sessionId: z.ZodOptional<z.ZodString>;
    todos: z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            in_progress: "in_progress";
            pending: "pending";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const evKeepAwakeState: z.ZodObject<{
    t: z.ZodLiteral<"ev.keep_awake_state">;
    enabled: z.ZodBoolean;
    active: z.ZodBoolean;
    platform: z.ZodString;
    backend: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 主机**此刻真正执行**的一组限额（规范 §13.2 的 `limits`）。
 *
 * ## 为什么这个载荷非有不可（L2 的那条义务）
 *
 * 同一个"功能存在"，在手机上可能表现为**三种**不同的东西：可点、置灰、根本不出现。
 * 从形状里推断必然在边界情形下静默错——§5.3 的 `ev.model` 就是实例：
 * 「内核不能换」与「能换但清单为空」在形状上分不出来，于是手机置灰了本来能点的。
 * 附件的条数上限同理：手机按自己写死的 4 去允许，而主机这一代只收 2——
 * 用户看到的是"选好的第 3 张，发出去没了"，没有任何报错。
 *
 * ## 每个字段为什么必须有值（不许 optional）
 *
 * 规范的 L2 要求报的是**此刻真正执行**的值，不是配置的名义值。既然主机侧真的
 * 按这些数在拒（`runtime.ts` 的 `cmd.send_prompt`），它就没有"我不知道"这种状态——
 * 把字段设成 optional 只会给"漏填一个、手机退回猜"留一条路，而那正是本载荷要消灭的东西。
 *
 * ⚠️ 反过来的那一半同样重要：**接收方不许用"字段缺失"推断"不支持"**（L3）。
 * 手机在收到这一帧之前的状态是"**不知道**"——它与"报了 0"是两件事
 * （前者放行、后者置灰，见 `client.js` 的 `imageAttachmentLimit`）。
 */
export declare const hostLimits: z.ZodObject<{
    maxImageAttachments: z.ZodNumber;
    maxFileAttachments: z.ZodNumber;
    maxAttachmentBytes: z.ZodNumber;
    maxTextChars: z.ZodNumber;
}, z.core.$strip>;
/**
 * `ev.host_info` —— 主机显式上报自己的限额与自身信息（规范 §13.2，GAP-5）。
 *
 * ⚠️ 2026-10-11 晚：**`caps`（能力位）整条删掉**。它原来的唯一职责是让手机判断
 * "对端会不会回 `latestSeq`"（`drc.payload.resume`），以便在不支持时退回重拉一页。
 * 三端同版本发版 ⇒ 不存在"对端可能不支持"，那条降级路径连同能力注册表一起消失。
 * 手机现在**总是**按差量续传走（见 `client.js` 的 `resumeHistory`）。
 *
 * ## 为什么这些数只能由主机在**加密通道**里说
 *
 * 限额（图片/文件张数、字节上限）是内容面的判断，而中继是**结构性零知识**的：
 * 让中继来回答"主机能收多少"会把一个内容面的判断塞进一个只负责转发的角色，
 * 且它手上的那份随时可能过期。由主机自己说，时效性与真实性都由唯一知情者负责。
 */
export declare const evHostInfo: z.ZodObject<{
    t: z.ZodLiteral<"ev.host_info">;
    host: z.ZodObject<{
        platform: z.ZodString;
        arch: z.ZodString;
        profile: z.ZodOptional<z.ZodString>;
        carrier: z.ZodOptional<z.ZodString>;
        dshVersion: z.ZodOptional<z.ZodString>;
        pluginVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    limits: z.ZodObject<{
        maxImageAttachments: z.ZodNumber;
        maxFileAttachments: z.ZodNumber;
        maxAttachmentBytes: z.ZodNumber;
        maxTextChars: z.ZodNumber;
    }, z.core.$strip>;
    state: z.ZodObject<{
        sleep: z.ZodEnum<{
            caffeinate: "caffeinate";
            "systemd-inhibit": "systemd-inhibit";
            unsupported: "unsupported";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
/** 一个可切换的模型候选。`value` 会被手机逐字回传，所以它必须与主机侧的键同名同值。 */
export declare const modelOption: z.ZodObject<{
    value: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ModelOption = z.infer<typeof modelOption>;
/**
 * 当前模型。
 *
 * 为什么要显式带 `canSwitch`，而不是让手机看`options` 有没有值来推断：
 * 「内核不能换」和「内核能换但这里没列全」在手机上必须表现不同 ——
 * 前者下拉要置灰并说明原因，后者是可点的列表。一个字段省掉，代价是
 * 「点了没反应」这个最难排查的现象。
 *
 * **这一代内核只能读**（`agentDefaultModel` 上只有 `currentSelection`），
 * 所以线上 `canSwitch` 是 `false`、`options` 为空。字段先立好，
 * 内核补上写能力后只改宿主那一侧。
 */
export declare const evModel: z.ZodObject<{
    t: z.ZodLiteral<"ev.model">;
    sessionId: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodString;
    canSwitch: z.ZodBoolean;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const evResult: z.ZodObject<{
    t: z.ZodLiteral<"ev.result">;
    cmdId: z.ZodString;
    ok: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/**
 * 一页历史条目。**故意复用实时流那两种载荷**，而不是另立一套"历史消息"形状。
 *
 * 理由是小程序侧的成本：聊天页的块流模型（轮次/指令/步骤组/正文）已经把
 * `ev.message_delta` 与 `ev.tool_event` 的回放规则写死了一遍。历史若另立形状，
 * 同一套规则就得写第二遍，而两份实现迟早分叉——表现是"实时看着对、历史看着怪"，
 * 这种缺陷很难靠肉眼发现。
 *
 * 深不递归：这里只允许三种**叶子**载荷，`ev.session_history` 自身不在其中。
 * 第三种是 `evTodo`（2026-10-05 补）：待办是**全量快照**，一页里最后一条就是那一页
 * 截止时的清单；回放它让"进一条跑过的会话也看得见待办"成立，不用等下一次
 * `todo/write`。这一条只放**当前代**认识的载荷：回放里出现别的 `t` 会被整条拒掉
 * （`historyItem` 是判别联合，不是"不认识就跳过"）。
 */
declare const historyItem: z.ZodDiscriminatedUnion<[z.ZodObject<{
    t: z.ZodLiteral<"ev.message_delta">;
    sessionId: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    part: z.ZodOptional<z.ZodNumber>;
    delta: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        assistant: "assistant";
        system: "system";
        user: "user";
    }>>;
    done: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.tool_event">;
    sessionId: z.ZodOptional<z.ZodString>;
    callId: z.ZodString;
    tool: z.ZodOptional<z.ZodString>;
    phase: z.ZodEnum<{
        args: "args";
        completed: "completed";
        failed: "failed";
        started: "started";
    }>;
    title: z.ZodOptional<z.ZodString>;
    argsPreview: z.ZodOptional<z.ZodString>;
    resultPreview: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.todo">;
    sessionId: z.ZodOptional<z.ZodString>;
    todos: z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            in_progress: "in_progress";
            pending: "pending";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>], "t">;
/** 历史里的一条。 */
export type HistoryItem = z.infer<typeof historyItem>;
/**
 * 主机已有的历史（一次一页，按 seq **升序**）。
 *
 * 三条约定：
 * - `items[].t` 与实时流同构，小程序用**同一条分发路径**回放，不写第二套渲染规则；
 * - **只有游标，没有 `hasMore`**：`nextBeforeSeq` 在 = 还有更早的一页（把它原样回传进
 *   `cmd.session_history.beforeSeq`），不在 = 到底了。用两个字段表达同一件事，
 *   迟早会出现"说还有、却没给游标"这种自相矛盾的载荷，而它的表现是——
 *   手机上「加载更早」点了没反应，且没有任何报错。一个字段就没有这种状态。
 * - 翻页游标由**主机**给：一条原始内核事件可能被折叠成 0/1/2 条线格式条目，
 *   小程序既不知道折叠规则也不该知道，按条数自己推算迟早会跳过或重发一段。
 * - 条目里不带 `ev.run_state`：运行态是"此刻"的事，回放历史不该去改顶栏。
 */
export declare const evSessionHistory: z.ZodObject<{
    t: z.ZodLiteral<"ev.session_history">;
    sessionId: z.ZodString;
    cmdId: z.ZodString;
    items: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        t: z.ZodLiteral<"ev.message_delta">;
        sessionId: z.ZodOptional<z.ZodString>;
        messageId: z.ZodString;
        part: z.ZodOptional<z.ZodNumber>;
        delta: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<{
            assistant: "assistant";
            system: "system";
            user: "user";
        }>>;
        done: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        t: z.ZodLiteral<"ev.tool_event">;
        sessionId: z.ZodOptional<z.ZodString>;
        callId: z.ZodString;
        tool: z.ZodOptional<z.ZodString>;
        phase: z.ZodEnum<{
            args: "args";
            completed: "completed";
            failed: "failed";
            started: "started";
        }>;
        title: z.ZodOptional<z.ZodString>;
        argsPreview: z.ZodOptional<z.ZodString>;
        resultPreview: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        t: z.ZodLiteral<"ev.todo">;
        sessionId: z.ZodOptional<z.ZodString>;
        todos: z.ZodArray<z.ZodObject<{
            content: z.ZodString;
            status: z.ZodEnum<{
                completed: "completed";
                in_progress: "in_progress";
                pending: "pending";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "t">>;
    nextBeforeSeq: z.ZodOptional<z.ZodNumber>;
    latestSeq: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** evSessionChanged 的推导类型。 */
export type EvSessionChanged = z.infer<typeof evSessionChanged>;
/** evMessageDelta 的推导类型。 */
export type EvMessageDelta = z.infer<typeof evMessageDelta>;
/** evToolEvent 的推导类型。 */
export type EvToolEvent = z.infer<typeof evToolEvent>;
/** evPermissionRequest 的推导类型。 */
export type EvPermissionRequest = z.infer<typeof evPermissionRequest>;
/** evPermissionResolved 的推导类型。 */
export type EvPermissionResolved = z.infer<typeof evPermissionResolved>;
/** evQuestionRequest 的推导类型。 */
export type EvQuestionRequest = z.infer<typeof evQuestionRequest>;
/** evQuestionResolved 的推导类型。 */
export type EvQuestionResolved = z.infer<typeof evQuestionResolved>;
/** evRunState 的推导类型。 */
export type EvRunState = z.infer<typeof evRunState>;
/** evTodo 的推导类型。 */
export type EvTodo = z.infer<typeof evTodo>;
/** evKeepAwakeState 的推导类型。 */
export type EvKeepAwakeState = z.infer<typeof evKeepAwakeState>;
/** evHostInfo 的推导类型。 */
export type EvHostInfo = z.infer<typeof evHostInfo>;
/** hostLimits 的推导类型。 */
export type HostLimits = z.infer<typeof hostLimits>;
/** evModel 的推导类型。 */
export type EvModel = z.infer<typeof evModel>;
/** evResult 的推导类型。 */
export type EvResult = z.infer<typeof evResult>;
/** evSessionHistory 的推导类型。 */
export type EvSessionHistory = z.infer<typeof evSessionHistory>;
/** cmdSessionHistory 的推导类型。 */
export type CmdSessionHistory = z.infer<typeof cmdSessionHistory>;
/** cmdSendPrompt 的推导类型。 */
export type CmdSendPrompt = z.infer<typeof cmdSendPrompt>;
/** cmdAnswer 的推导类型。 */
export type CmdAnswer = z.infer<typeof cmdAnswer>;
/** cmdResolvePermission 的推导类型。 */
export type CmdResolvePermission = z.infer<typeof cmdResolvePermission>;
/** cmdInterrupt 的推导类型。 */
export type CmdInterrupt = z.infer<typeof cmdInterrupt>;
/** cmdListSessions 的推导类型。 */
export type CmdListSessions = z.infer<typeof cmdListSessions>;
/** cmdKeepAwake 的推导类型。 */
export type CmdKeepAwake = z.infer<typeof cmdKeepAwake>;
/** cmdNewSession 的推导类型。 */
export type CmdNewSession = z.infer<typeof cmdNewSession>;
/** cmdGetPending 的推导类型。 */
export type CmdGetPending = z.infer<typeof cmdGetPending>;
/** cmdArchiveSession 的推导类型。 */
export type CmdArchiveSession = z.infer<typeof cmdArchiveSession>;
/**
 * 出站载荷（host → client）。小程序解密后按 `t` 分发，认不出的类型被**静默丢弃**，
 * 所以新增名字安全，改既有语义不安全。
 */
export declare const evPayload: z.ZodDiscriminatedUnion<[z.ZodObject<{
    t: z.ZodLiteral<"ev.session_changed">;
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        state: z.ZodOptional<z.ZodEnum<{
            archived: "archived";
            "awaiting-answer": "awaiting-answer";
            "awaiting-permission": "awaiting-permission";
            detached: "detached";
            idle: "idle";
            running: "running";
        }>>;
        running: z.ZodOptional<z.ZodBoolean>;
        title: z.ZodOptional<z.ZodString>;
        workspace: z.ZodOptional<z.ZodString>;
        updatedAt: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodOptional<z.ZodString>;
        origin: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.message_delta">;
    sessionId: z.ZodOptional<z.ZodString>;
    messageId: z.ZodString;
    part: z.ZodOptional<z.ZodNumber>;
    delta: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        assistant: "assistant";
        system: "system";
        user: "user";
    }>>;
    done: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.tool_event">;
    sessionId: z.ZodOptional<z.ZodString>;
    callId: z.ZodString;
    tool: z.ZodOptional<z.ZodString>;
    phase: z.ZodEnum<{
        args: "args";
        completed: "completed";
        failed: "failed";
        started: "started";
    }>;
    title: z.ZodOptional<z.ZodString>;
    argsPreview: z.ZodOptional<z.ZodString>;
    resultPreview: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.permission_request">;
    sessionId: z.ZodOptional<z.ZodString>;
    requestId: z.ZodString;
    action: z.ZodString;
    resource: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, z.core.$strip>>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.permission_resolved">;
    requestId: z.ZodString;
    sessionId: z.ZodString;
    by: z.ZodEnum<{
        cancelled: "cancelled";
        desktop: "desktop";
    }>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.question_request">;
    sessionId: z.ZodOptional<z.ZodString>;
    requestId: z.ZodString;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        question: z.ZodString;
        multi: z.ZodOptional<z.ZodBoolean>;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.question_resolved">;
    requestId: z.ZodString;
    sessionId: z.ZodString;
    by: z.ZodEnum<{
        cancelled: "cancelled";
        desktop: "desktop";
    }>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.run_state">;
    sessionId: z.ZodOptional<z.ZodString>;
    state: z.ZodEnum<{
        idle: "idle";
        running: "running";
    }>;
    detail: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.todo">;
    sessionId: z.ZodOptional<z.ZodString>;
    todos: z.ZodArray<z.ZodObject<{
        content: z.ZodString;
        status: z.ZodEnum<{
            completed: "completed";
            in_progress: "in_progress";
            pending: "pending";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.retry">;
    sessionId: z.ZodString;
    attempt: z.ZodNumber;
    max: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.compaction">;
    sessionId: z.ZodString;
    state: z.ZodEnum<{
        ended: "ended";
        failed: "failed";
        started: "started";
    }>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.keep_awake_state">;
    enabled: z.ZodBoolean;
    active: z.ZodBoolean;
    platform: z.ZodString;
    backend: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.host_info">;
    host: z.ZodObject<{
        platform: z.ZodString;
        arch: z.ZodString;
        profile: z.ZodOptional<z.ZodString>;
        carrier: z.ZodOptional<z.ZodString>;
        dshVersion: z.ZodOptional<z.ZodString>;
        pluginVersion: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    limits: z.ZodObject<{
        maxImageAttachments: z.ZodNumber;
        maxFileAttachments: z.ZodNumber;
        maxAttachmentBytes: z.ZodNumber;
        maxTextChars: z.ZodNumber;
    }, z.core.$strip>;
    state: z.ZodObject<{
        sleep: z.ZodEnum<{
            caffeinate: "caffeinate";
            "systemd-inhibit": "systemd-inhibit";
            unsupported: "unsupported";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.model">;
    sessionId: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodString;
    canSwitch: z.ZodBoolean;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.result">;
    cmdId: z.ZodString;
    ok: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"ev.session_history">;
    sessionId: z.ZodString;
    cmdId: z.ZodString;
    items: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        t: z.ZodLiteral<"ev.message_delta">;
        sessionId: z.ZodOptional<z.ZodString>;
        messageId: z.ZodString;
        part: z.ZodOptional<z.ZodNumber>;
        delta: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<{
            assistant: "assistant";
            system: "system";
            user: "user";
        }>>;
        done: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        t: z.ZodLiteral<"ev.tool_event">;
        sessionId: z.ZodOptional<z.ZodString>;
        callId: z.ZodString;
        tool: z.ZodOptional<z.ZodString>;
        phase: z.ZodEnum<{
            args: "args";
            completed: "completed";
            failed: "failed";
            started: "started";
        }>;
        title: z.ZodOptional<z.ZodString>;
        argsPreview: z.ZodOptional<z.ZodString>;
        resultPreview: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        t: z.ZodLiteral<"ev.todo">;
        sessionId: z.ZodOptional<z.ZodString>;
        todos: z.ZodArray<z.ZodObject<{
            content: z.ZodString;
            status: z.ZodEnum<{
                completed: "completed";
                in_progress: "in_progress";
                pending: "pending";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "t">>;
    nextBeforeSeq: z.ZodOptional<z.ZodNumber>;
    latestSeq: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>], "t">;
export type EvPayload = z.infer<typeof evPayload>;
/**
 * 一条随消息带的图片附件（2026-10-04 加，可选）。
 *
 * 为什么是 base64 而不是路径：图片在**手机上**，主机那头没有这个文件；而整条载荷
 * 是 JSON（之后还要 seal 成密文帧），二进制在 JSON 里只有 base64 一条路。
 * 于是体积纪律全在 mp 侧：`wx.compressImage` 先压（质量 + 最长边），
 * 中继 `DRC_MAX_MSG_BYTES` 是硬上限（默认 1MB，见 server 仓），超了整条帧被掐。
 * **只收 jpeg**：相册选完压出来就是 jpeg，png 的先让 mp 转（ compressImage 统一输出）。
 */
export declare const imageAttachment: z.ZodObject<{
    name: z.ZodString;
    mediaType: z.ZodLiteral<"image/jpeg">;
    data: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ImageAttachment = z.infer<typeof imageAttachment>;
/**
 * 文件附件（2026-10-05 加，用户："文件附件也支持一下"）。
 *
 * 与图片的三处不同，都是被文件这件事本身逼出来的：
 * 1. **没有 mediaType 白名单**。图片那边收 `image/jpeg` 字面量，是因为相册出来
 *    必然能被画布重编码成 jpeg；文件没有这一步，pdf/doc/xlsx 各有各的格式，
 *    主机这边只记录类型、不解析内容（真要解析得引入一整柜 MIME 嗅探，不值）。
 * 2. **没有体积以外的第二道内容校验**。图片有 JPEG 魔数，文件的"魔数"族类太多，
 *    所以纪律全落在 mp 侧的两道闸与主机的单条上限上。
 * 3. **文件名就是落盘名**（图片会被强改成 .jpg）。扩展名必须留着——Agent
 *    认文件靠的就是它。收敛仍走 `safeSegment`：手机传来的名字是不可信输入。
 *
 * 与图片共用同一条预算（见 `MAX_ATTACH_TOTAL_BYTES`）：中继单帧 1MB 是硬上限，
 * 超了不是"发不出去"而是整帧被掐、socket 1009 断开。所以文件也不做压缩——
 * 超预算的被挡下并说清，而不是悄悄砍掉一半内容。
 */
export declare const fileAttachment: z.ZodObject<{
    name: z.ZodString;
    mediaType: z.ZodOptional<z.ZodString>;
    data: z.ZodString;
}, z.core.$strip>;
export type FileAttachment = z.infer<typeof fileAttachment>;
export declare const cmdSendPrompt: z.ZodObject<{
    t: z.ZodLiteral<"cmd.send_prompt">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    text: z.ZodString;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        mediaType: z.ZodLiteral<"image/jpeg">;
        data: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    files: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        mediaType: z.ZodOptional<z.ZodString>;
        data: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
declare const answerItem: z.ZodObject<{
    questionId: z.ZodString;
    selected: z.ZodArray<z.ZodString>;
    freeText: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 一道题的作答。 */
export type AnswerItem = z.infer<typeof answerItem>;
export declare const cmdAnswer: z.ZodObject<{
    t: z.ZodLiteral<"cmd.answer">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    requestId: z.ZodString;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        selected: z.ZodArray<z.ZodString>;
        freeText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const cmdResolvePermission: z.ZodObject<{
    t: z.ZodLiteral<"cmd.resolve_permission">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    requestId: z.ZodString;
    decision: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const cmdInterrupt: z.ZodObject<{
    t: z.ZodLiteral<"cmd.interrupt">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
}, z.core.$strip>;
export declare const cmdListSessions: z.ZodObject<{
    t: z.ZodLiteral<"cmd.list_sessions">;
    cmdId: z.ZodString;
}, z.core.$strip>;
/**
 * 新建一个会话。
 *
 * **不带标题**：命名的权力在主机那一侧（内核 `sessionController.commands.create({})`
 * 不传 sessionId 就分配一个新的，不传 cwd 就用默认项目目录）。手机擅自编一个"新会话"
 * 塞过去，只会盖掉主机自己的命名规则，而且第一次发指令后标题还会被内核改掉——
 * 那时候用户看到的就是一条**自己改过名字的会话又变了名**。
 *
 * 回执走 `ev.result`：它本来就有 `cmdId`（对答靠它匹配）与 `ok`/`message`
 * （失败时手机要能说出原因），`data.sessionId` 带上新会话的 id。
 * 为这一件事新立一个 `ev.*` 载荷不值得——那会让"结果回执"有两条并行的路。
 */
/**
 * 手机请求新建一条会话，并**可以指明落在哪个工作区**（可选）。
 *
 * ## 为什么加这个字段（2026-10-06 用户报："在 dsh 的工作区为未分组"）
 *
 * DSH 的会话列表按项目目录分组。不带 cwd 创建时，内核退到宿主进程的默认目录（真机上是 `/`），
 * 于是那条会话落进**未分组**——手机侧照常能用（它按 id 过滤，不看分组），
 * 但用户在电脑前看到的是"新建了却不知道在哪"，只能靠未分组那一堆自己找。
 *
 * ## 为什么是"可选"而不是必填
 *
 * 因为它表达的是**手机此刻不知道**：`sessions.js` 里那个 `workspace` 可能是空串
 * （用户从没选过工作区、会话列表里也没有可继承的那一条）。这时**不带**这个键，
 * 主机走它自己的推断（`workspaceRegistry.list()` 那条兜底），而不是让手机编一个路径。
 *
 * 取值是**目录绝对路径**（`/Users/x/dsh-remote-control`），与 `SessionSummary.workspace`
 * 同一个字符串——手机那边本来就是从会话列表里原样取出来的，不做换算，也就不存在两侧对不上的可能。
 */
export declare const cmdNewSession: z.ZodObject<{
    t: z.ZodLiteral<"cmd.new_session">;
    cmdId: z.ZodString;
    workspace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const cmdKeepAwake: z.ZodObject<{
    t: z.ZodLiteral<"cmd.keep_awake">;
    cmdId: z.ZodString;
    enabled: z.ZodBoolean;
    idleReleaseSec: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * 读主机上已有的历史（`sessionId` 是 DSH 会话 id，不是配对通道 id，F3）。
 *
 * 分页语义刻意做成「**游标由主机给、小程序原样回传**」：
 * - 不带 `beforeSeq` = 要最新的一页；
 * - 带 `beforeSeq` = 要 `seq < beforeSeq` 的那一页，取值来自上一次响应的 `nextBeforeSeq`；
 * - 带 `since` = **向前补差量**（要 `seq > since` 的那些），与 `beforeSeq` **互斥**。
 *
 * 为什么不按"第几页/每页 N 条"来切：一条原始内核事件可能被折叠成 0 条（空文本的
 * assistant/message）、1 条或 2 条（tool/call + tool/result）线格式条目，
 * 小程序既不知道折叠规则也不该知道。让它按条数推算翻页，迟早会跳过或重发一段。
 *
 * ## 补差量（`since`）—— 为什么是会话层概念，不是传输层
 *
 * 断线重连后手机要补上"我不在的那几秒"。v2 的做法是**重拉一页历史**，而那一页
 * 是按 `beforeSeq` 向更早翻的——于是补差量与翻页混在同一条命令上，语义要靠
 * 参数组合去猜。`since` 把它显式化：**向前**（`seq >`）与**向后**（`seq <`）是两个方向。
 *
 * ⚠️ 两条硬约束：
 * 1. **互斥**：`since` 与 `beforeSeq` 同时出现 ⇒ schema 拒（下面 refine）。
 *    "两个方向一起走"没有可定义的语义，放行等于让实现自己挑一个，而挑错的表现是
 *    **静默漏掉一段消息**。
 * 2. **窗口外要明说**：主机只保留最近 N 条（`since` 落在窗口外就回
 *    `history_window_exceeded`），**不许**静默从窗口头部开始给——那会让手机
 *    以为补齐了，实际中间缺一段。
 *
 * 这两个约束都是**会话层**的，与用 WS 还是 SSE 承载无关（V3-PLAN §5.1）。
 */
export declare const cmdSessionHistory: z.ZodObject<{
    t: z.ZodLiteral<"cmd.session_history">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    beforeSeq: z.ZodOptional<z.ZodNumber>;
    since: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * 拉取还挂着的审批/提问（手机拉，`pending` 重发）。
 *
 * 背景：审批/提问卡是"一次性"的一帧——手机退后台、断线、停在列表页时错过就没了，
 * 而主机还阻塞着等决定。`peer-joined` 的重发只发生在重配对；
 * 普通 socket 重连中继不通知主机，主机收不到任何信号。
 * 于是手机在（重）连上、进会话页时主动拉一次：主机把 `pending` 里还挂着的
 * 按原请求帧重发（同一 `requestId`，手机按卡覆盖），没有就只回 `ev.result{ok:true}`。
 *
 * `sessionId` 可选：带了只重发那条会话的，没有全重发（手机按 sessionId 过滤显示，
 * 多发不翻倍）。这是**手机主动拉**的一条命令：fire-and-forget，收不到就当没有 ——
 * 不做 waiter、不弹错（重连后的正路是主机在 `onClientRejoined` 里主动 `replayPending`）。
 */
export declare const cmdGetPending: z.ZodObject<{
    t: z.ZodLiteral<"cmd.get_pending">;
    cmdId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 归档 / 取消归档一条会话（`sessionId` 是 DSH 会话 id，不是配对通道 id，F3）。
 *
 * ## 名字为什么是小写下划线
 *
 * `cmd.archive_session` 而不是 `cmd.archiveSession`——`e2e/wire-surface.test.mjs`
 * 那道闸的正则是 `^(cmd|ev)\.[a-z0-9_]+$`，驼峰会被它判成"手拼错了"。
 * 与其改那道闸（它拦的是真 typo），不如跟着它的形状写。
 *
 * ## `archived: false` 是取消归档
 *
 * 用一个布尔而不是两条命令：归档与取消归档是**同一个内核方法的两侧**
 * （`workspaceRegistry.archiveSession` / `unarchiveSession`），
 * 而协议层每加一条命令就要在四个地方各写一遍（`PAYLOAD_TYPES`、`CMD_TYPES`、
 * mp 的便捷方法、宿主的 switch）。少一半登记点等于少一半"加了命令忘了接线"的机会。
 *
 * ## 缺省是 `true`（归档）
 *
 * 手机发的是"归档"这个动作，`archived: false` 只在取消时出现。方向选错的后果
 * 是不对称的：把"取消"当成"归档"会**藏起**一条会话（还能取消回来）；
 * 反过来会把一条归档会话**放回列表**（用户会以为归档没生效）。
 * 所以宁可让缺省落在可逆的那一侧。
 *
 * ## ⚠️ 不含 `stopActivity`（刻意）
 *
 * 内核的 `archiveSession(sessionId, { stopActivity })` 在会话还在跑时**抛**
 * `WorkspaceActiveSessionError`，除非传 `stopActivity: true`——而那会**停掉主机上
 * 正在跑的工作**。那与"插件不改变宿主自己的行为"这条纪律直接冲突：
 * 用户在手机上误点一下，主机上正在跑的任务就断了。
 *
 * 所以协议里**根本没有这个字段**：主机侧收到这一条时的正确行为是
 * **明确回 `ev.result{ok:false, message}` 说"会话正在运行，不能归档"**，
 * 让用户回工作台停。要"连带停掉"是另一个决定，需要另开一条命令并单独评审。
 */
export declare const cmdArchiveSession: z.ZodObject<{
    t: z.ZodLiteral<"cmd.archive_session">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    archived: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * 改一条会话的标题。
 *
 * `min(1)` 是挡空串：空标题传下去内核会把标题清空，而手机端列表靠标题认人。
 * 长度上限 200 与内核侧限制一致。
 */
export declare const cmdRenameSession: z.ZodObject<{
    t: z.ZodLiteral<"cmd.rename_session">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    title: z.ZodString;
}, z.core.$strip>;
/** 取主机当前的模型清单（分组 + 每个模型可用的努力程度）。 */
export declare const cmdGetModels: z.ZodObject<{
    t: z.ZodLiteral<"cmd.get_models">;
    cmdId: z.ZodString;
}, z.core.$strip>;
/**
 * 给某条会话切模型，可选带努力程度。
 *
 * `reasoningEffort` 可选：不传 = 沿用该会话/该模型当前的默认努力程度。
 */
export declare const cmdSetModel: z.ZodObject<{
    t: z.ZodLiteral<"cmd.set_model">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    reasoningEffort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 手机发来的命令，共 10 种——就是 `packages/client/core/client.js` 的便捷方法能产出的全部。
 *
 * 旧实现还有一个 `cmd.subscribe`：它的 handler 只回一个 `ev.result{ok:true}`，
 * `sessionIds`/`includeContent` 没有任何过滤效果，而小程序从不发它。
 * 本版不实现它（取证 legacy-spec/relay-and-wireformat.md §4.1 的"事实上的 no-op"）。
 */
export declare const cmdPayload: z.ZodDiscriminatedUnion<[z.ZodObject<{
    t: z.ZodLiteral<"cmd.send_prompt">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    text: z.ZodString;
    images: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        mediaType: z.ZodLiteral<"image/jpeg">;
        data: z.ZodString;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    files: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        mediaType: z.ZodOptional<z.ZodString>;
        data: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.answer">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    requestId: z.ZodString;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        selected: z.ZodArray<z.ZodString>;
        freeText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.resolve_permission">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    requestId: z.ZodString;
    decision: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.interrupt">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.list_sessions">;
    cmdId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.keep_awake">;
    cmdId: z.ZodString;
    enabled: z.ZodBoolean;
    idleReleaseSec: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.session_history">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    beforeSeq: z.ZodOptional<z.ZodNumber>;
    since: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.new_session">;
    cmdId: z.ZodString;
    workspace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.get_pending">;
    cmdId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.archive_session">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    archived: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.rename_session">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    title: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.get_models">;
    cmdId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    t: z.ZodLiteral<"cmd.set_model">;
    cmdId: z.ZodString;
    sessionId: z.ZodString;
    provider: z.ZodString;
    model: z.ZodString;
    reasoningEffort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "t">;
export type CmdPayload = z.infer<typeof cmdPayload>;
/** 解析手机发来的命令；非法返回 null（调用方决定丢弃还是回 `ev.result{ok:false}`）。 */
export declare function parseCmdPayload(value: unknown): CmdPayload | null;
/** 解析事件载荷（中继 e2e 审计与插件自测用）。 */
export declare function parseEvPayload(value: unknown): EvPayload | null;
/** 载荷类型名常量（分发与测试断言用，避免各处手打字符串）。 */
export declare const PAYLOAD_TYPES: {
    readonly cmdSendPrompt: 'cmd.send_prompt';
    readonly cmdAnswer: 'cmd.answer';
    readonly cmdResolvePermission: 'cmd.resolve_permission';
    readonly cmdInterrupt: 'cmd.interrupt';
    readonly cmdListSessions: 'cmd.list_sessions';
    readonly cmdKeepAwake: 'cmd.keep_awake';
    readonly cmdSessionHistory: 'cmd.session_history';
    readonly cmdNewSession: 'cmd.new_session';
    readonly cmdGetPending: 'cmd.get_pending';
    readonly cmdArchiveSession: 'cmd.archive_session';
    readonly cmdRenameSession: 'cmd.rename_session';
    readonly cmdGetModels: 'cmd.get_models';
    readonly cmdSetModel: 'cmd.set_model';
    readonly evSessionChanged: 'ev.session_changed';
    readonly evMessageDelta: 'ev.message_delta';
    readonly evToolEvent: 'ev.tool_event';
    readonly evPermissionRequest: 'ev.permission_request';
    readonly evPermissionResolved: 'ev.permission_resolved';
    readonly evQuestionRequest: 'ev.question_request';
    readonly evQuestionResolved: 'ev.question_resolved';
    readonly evRunState: 'ev.run_state';
    readonly evTodo: 'ev.todo';
    readonly evRetry: 'ev.retry';
    readonly evCompaction: 'ev.compaction';
    readonly evKeepAwakeState: 'ev.keep_awake_state';
    readonly evHostInfo: 'ev.host_info';
    readonly evModel: 'ev.model';
    readonly evResult: 'ev.result';
    readonly evSessionHistory: 'ev.session_history';
};
/**
 * 生产侧兜住 F7：只有能被 `Date.parse` 认出来的值才作为 ISO 字符串下发，
 * 否则**整个字段省略**（小程序把它当可选字段，缺省不显示时间角标）。
 *
 * 为什么不在校验器里管：校验器只管收到的东西对不对；而这里要防的是我们自己
 * 把内核给的**毫秒数**直接塞进去——那是一次"发得出去、对方静默坏掉"的错误。
 *
 * 两条 2026-10-06 审计补的纪律：
 * 1. **字符串要归一化**：`Date.parse` 认得的非 ISO 写法（`2026/10/06`、`Oct 6 2026`）
 *    原来原样下发，而契约写的是"只接受 ISO"。现在统一折成 `toISOString()`，手机拿到的
 *    永远是同一种形状。
 * 2. **超大数不再抛**：`new Date(1e300).toISOString()` 抛 RangeError，而本函数是
 *    "最后一道防线"，抛出去会顺着 status/session 列表那条路带崩调用方。超范围
 *    一律当"没有值"（省略字段），与其余失败面一致。
 */
export declare function isoOrUndefined(value: unknown): string | undefined;
export {};
