// types for the send flow - direct payments to peanut usernames
// note: main types are in SendFlowContext.tsx to avoid circular imports

import { type Address } from 'viem'

// re-export types from context for convenience
export type { SendFlowView, SendRecipient, SendAttachment, SendFlowErrorState } from './SendFlowContext'

// props for resolving a username to recipient
export interface ResolveUsernameResult {
    username: string
    address: Address
    userId?: string
    fullName?: string
}
