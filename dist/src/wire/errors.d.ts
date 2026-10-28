/**
 * errors — 错误码的**语义**（规范 §12.2）。
 *
 * ## 为什么错误码旁边要挂一张"可重试性"表
 *
 * 错误码本身只说"发生了什么"，不说"该怎么办"。而端点真正需要的是后者：
 * `rate_limited` 该退避重试，`unknown_session` 该清配对要求重扫，
 * `bad_frame` 该改代码——三者的用户可见表现完全不同。
 *
 * 现状是每个消费方各自推断：中继有一张中文文案表（`CLIENT_ERROR_TEXT`），
 * 插件**只记日志不分支**（`dsh-remote-control/packages/plugin/src/transport/relay.ts:472-479`），
 * 小程序只特判 `unknown_session`（`core/client.js:352`）。三份推断各自漂移，
 * 而且没有一处能回答"这个码到底该怎么办"。
 *
 * 这张表把可重试性变成协议层的事实。中文文案**不在这里**：文案是产品与部署方的责任，
 * 协议层只保证"发出去的是机器可判的码 + 一个可选的重试提示"。
 */
import { type ErrorCode } from './frames.js';
/** 这个错误码值不值得原样重试。 */
export declare function isRetryableError(code: unknown): code is ErrorCode;
/** 这个错误码适合带一个重试等待提示。 */
export declare function wantsRetryAfter(code: unknown): boolean;
/** 错误码的技术描述。未知码返回 `undefined`（不编造）。 */
export declare function describeErrorCode(code: unknown): string | undefined;
/** 全部错误码（注册表的转出，供文档与闸门打印实测值）。 */
export declare const ERROR_CODES: readonly ErrorCode[];
