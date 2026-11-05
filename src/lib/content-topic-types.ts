import type { Translations } from '@/i18n/types'

export const CONTENT_TOPICS = ['countries', 'deposit', 'receive', 'send', 'pay', 'withdraw'] as const
export type ContentTopic = (typeof CONTENT_TOPICS)[number]

const COPY_KEYS = {
    countries: ['contentTopicCountriesTitle', 'contentTopicCountriesDescription'],
    deposit: ['contentTopicDepositTitle', 'contentTopicDepositDescription'],
    receive: ['contentTopicReceiveTitle', 'contentTopicReceiveDescription'],
    send: ['contentTopicSendTitle', 'contentTopicSendDescription'],
    pay: ['contentTopicPayTitle', 'contentTopicPayDescription'],
    withdraw: ['contentTopicWithdrawTitle', 'contentTopicWithdrawDescription'],
} as const

export function getContentTopicCopy(i18n: Translations, topic: ContentTopic) {
    const [title, description] = COPY_KEYS[topic]
    return { title: i18n[title], description: i18n[description] }
}
