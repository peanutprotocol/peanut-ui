/**
 * ERC-4337 `UserOperationRevertReason` event topic.
 *
 * Lives here rather than in zerodev.consts so that consumers needing only this
 * string don't pull that module's chain lookup, which imports viem's full
 * ~700-chain registry (596 KB) into their bundle.
 */
export const USER_OPERATION_REVERT_REASON_TOPIC = '0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201'
