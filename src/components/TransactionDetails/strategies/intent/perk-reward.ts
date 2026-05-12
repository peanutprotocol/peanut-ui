// Synthetic PERK_REWARD kind — perk_usage rows projected through the
// unified history mapper. Always rendered as an incoming receive from
// "Peanut Rewards".

import { type TransactionStrategy, type TransactionStrategyOutput } from '../types'

export const perkReward: TransactionStrategy = (): TransactionStrategyOutput => ({
    direction: 'receive',
    transactionCardType: 'receive',
    nameForDetails: 'Peanut Reward',
    fullName: 'Peanut Rewards',
    isPeerActuallyUser: false,
    isLinkTx: false,
})
