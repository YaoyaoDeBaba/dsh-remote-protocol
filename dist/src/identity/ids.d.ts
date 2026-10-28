/** 配对通道 id 的前缀。小程序把它当 convId 持久化并参与密钥派生，前缀不能改。 */
export declare const CONVERSATION_ID_PREFIX = "c_";
/** `c_` + 12 位 hex（48 bit）。它是路由凭证，不是密钥。 */
export declare function newConversationId(): string;
/** host 身份 id；缺省由中继分配，8 位 hex 够人读也够短。 */
export declare function newHostId(): string;
/** 命令关联 id。回执靠它对答，必须原样回传。 */
export declare function newCmdId(): string;
