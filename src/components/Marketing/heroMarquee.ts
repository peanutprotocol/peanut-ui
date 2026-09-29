import { type Translations } from '@/i18n/types'

/** The strip under a marketing hero, shared by MarketingHero and the MDX Hero. */
export function heroMarqueeMessages(i18n: Translations): string[] {
    return [i18n.heroMarqueeRateUpfront, i18n.heroMarqueeInstant, '24/7', i18n.heroMarqueeDollars, 'USDT/USDC']
}
