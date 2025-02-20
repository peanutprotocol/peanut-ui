// L1 TLD list based on supported chains
export const TLDS = ['eth', 'arbitrum', 'optimism', 'base', 'polygon'] as const

export type TLD = (typeof TLDS)[number]

// regex constants
export const CHAIN_ID_REGEX = /^0x[a-fA-F0-9]{1,64}$/
export const ENS_REGEX = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.eth$/
