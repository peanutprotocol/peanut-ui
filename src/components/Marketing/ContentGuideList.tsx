import { ContentLinkRow } from './ContentLinkRow'
import { HUB_WIDTH } from './constants'
import { isEnglishFallback } from '@/i18n/englishFallback'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import type { ContentGuide } from '@/lib/content-topics'

/** Server-rendered navigation for topic directories and relevant country guides. */
export function ContentGuideList({
    items,
    locale,
    heading,
}: {
    items: ContentGuide[]
    locale: Locale
    heading?: string
}) {
    if (items.length === 0) return null
    const i18n = getTranslations(locale)

    return (
        <nav aria-label={heading} className={`mx-auto ${HUB_WIDTH} px-6 py-8 md:px-4`}>
            {heading && <h2 className="mb-4 text-heading-xs md:text-heading-s">{heading}</h2>}
            <div className="flex flex-col">
                {items.map((item, index) => {
                    const english = isEnglishFallback(item.lang, locale)
                    return (
                        <ContentLinkRow
                            key={item.href}
                            href={item.href}
                            title={item.title.replace(/\s*\|\s*Peanut\s*$/i, '').trim() || item.title}
                            description={item.description}
                            wrap
                            index={index}
                            total={items.length}
                            lang={english ? item.lang : undefined}
                            languageLabel={english ? i18n.inEnglish : undefined}
                        />
                    )
                })}
            </div>
        </nav>
    )
}
