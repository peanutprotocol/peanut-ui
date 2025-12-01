'use client'

import { useMemo, useState } from 'react'
import Marquee from 'react-fast-marquee'
import { TWEETS, type Tweet } from '@/constants'

// =============================================================================
// Constants
// =============================================================================

/** Scroll speed in pixels per second */
const MARQUEE_SPEED = 40

/** Shadow offset for consistent column height calculation */
const CARD_SHADOW_OFFSET = 6

/**
 * Card height constants - all column types align to FEATURED_HEIGHT
 * - Featured: 440px (single card)
 * - Standard: 212px × 2 + 16px gap = 440px
 * - Tiny: 136px × 3 + 32px gap = 440px
 */
const FEATURED_HEIGHT = 440
const STANDARD_HEIGHT = 212
const TINY_HEIGHT = 136

/** Content length threshold for "tiny" tweets (characters) */
const TINY_CONTENT_THRESHOLD = 100

// =============================================================================
// Types
// =============================================================================

type ColumnType =
    | { type: 'featured'; tweet: Tweet }
    | { type: 'standard'; tweets: Tweet[] }
    | { type: 'tiny'; tweets: Tweet[] }

// =============================================================================
// Shared Components
// =============================================================================

/** Avatar with lazy loading and fallback to author initial */
const Avatar = ({ tweet }: { tweet: Tweet }) => {
    const [imgError, setImgError] = useState(false)

    if (!tweet.avatar || imgError) {
        return (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-n-1 text-white">
                <span className="text-xs font-bold">{tweet.author[0]?.toUpperCase()}</span>
            </div>
        )
    }

    return (
        <img
            src={tweet.avatar}
            alt={tweet.author}
            loading="lazy"
            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
            onError={() => setImgError(true)}
        />
    )
}

/** X/Twitter verified badge icon */
const VerifiedBadge = () => (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
    </svg>
)

/** X/Twitter logo icon */
const XLogo = () => (
    <svg className="h-4 w-4 flex-shrink-0 text-n-1 opacity-40" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
)

/** Consistent tweet header with avatar, name, handle, and X logo */
const TweetHeader = ({ tweet }: { tweet: Tweet }) => (
    <div className="flex items-center gap-2">
        <Avatar tweet={tweet} />
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold text-n-1">{tweet.author}</span>
                {tweet.verified && <VerifiedBadge />}
            </div>
            <span className="text-xs text-grey-1">{tweet.handle}</span>
        </div>
        <XLogo />
    </div>
)

// =============================================================================
// Card Components
// =============================================================================

/** Play button overlay for video tweets */
const PlayOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <svg className="ml-1 h-8 w-8 text-n-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
            </svg>
        </div>
    </div>
)

/** Base card styles shared across all card types */
const CARD_BASE_CLASSES =
    'shadow-primary-6 flex w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-sm border-2 border-n-1 bg-white transition-all duration-100 hover:brightness-95 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none'

/** Featured card with media (photo or video) - tallest card type */
const FeaturedCard = ({ tweet }: { tweet: Tweet }) => {
    const [imgError, setImgError] = useState(false)
    const photoMedia = tweet.media?.find((m) => m.type === 'photo')
    const videoMedia = tweet.media?.find((m) => m.type === 'video')
    const hasVideo = !!videoMedia

    return (
        <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ height: FEATURED_HEIGHT }}
            className={CARD_BASE_CLASSES}
        >
            {photoMedia && !imgError ? (
                <div className="relative h-[220px] w-full flex-shrink-0 overflow-hidden border-b-2 border-n-1 bg-grey-2">
                    <img
                        src={photoMedia.url}
                        alt="Tweet media"
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() => setImgError(true)}
                    />
                    {hasVideo && <PlayOverlay />}
                </div>
            ) : hasVideo ? (
                <div className="relative flex h-[220px] w-full flex-shrink-0 items-center justify-center overflow-hidden border-b-2 border-n-1 bg-black">
                    <PlayOverlay />
                </div>
            ) : (
                <div className="relative flex h-[220px] w-full flex-shrink-0 items-center justify-center overflow-hidden border-b-2 border-n-1 bg-gradient-to-br from-yellow-100 via-yellow-50 to-amber-100">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute -left-4 -top-4 text-7xl">🥜</div>
                        <div className="absolute -bottom-4 -right-4 text-7xl">🥜</div>
                    </div>
                    <span className="text-6xl drop-shadow-sm">🥜</span>
                </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col p-3">
                <TweetHeader tweet={tweet} />
                <p className="mt-2 line-clamp-4 flex-1 overflow-hidden text-[13px] leading-snug text-n-1">
                    {tweet.content}
                </p>
            </div>
        </a>
    )
}

/** Standard text card - medium height, displayed in pairs */
const StandardCard = ({ tweet }: { tweet: Tweet }) => (
    <a
        href={tweet.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ height: STANDARD_HEIGHT }}
        className={`${CARD_BASE_CLASSES} p-3`}
    >
        <TweetHeader tweet={tweet} />
        <p className="mt-2 line-clamp-6 flex-1 overflow-hidden text-[13px] leading-snug text-n-1">{tweet.content}</p>
    </a>
)

/** Tiny card for short tweets - compact height, displayed in groups of 3 */
const TinyCard = ({ tweet }: { tweet: Tweet }) => (
    <a
        href={tweet.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ height: TINY_HEIGHT }}
        className={`${CARD_BASE_CLASSES} p-3`}
    >
        <TweetHeader tweet={tweet} />
        <p className="mt-2 line-clamp-3 flex-1 overflow-hidden text-[13px] leading-snug text-n-1">{tweet.content}</p>
    </a>
)

// =============================================================================
// Column Component
// =============================================================================

/** Renders a column of cards based on column type */
const Column = ({ column }: { column: ColumnType }) => {
    const columnHeight = FEATURED_HEIGHT + CARD_SHADOW_OFFSET

    if (column.type === 'featured') {
        return (
            <div className="ml-3 pr-1 pt-[2px]" style={{ height: columnHeight }}>
                <FeaturedCard tweet={column.tweet} />
            </div>
        )
    }

    if (column.type === 'tiny') {
        return (
            <div className="ml-3 flex flex-col gap-4 pr-1 pt-[2px]" style={{ height: columnHeight }}>
                {column.tweets.map((tweet) => (
                    <TinyCard key={tweet.url} tweet={tweet} />
                ))}
            </div>
        )
    }

    return (
        <div className="ml-3 flex flex-col gap-4 pr-1 pt-[2px]" style={{ height: columnHeight }}>
            {column.tweets.map((tweet) => (
                <StandardCard key={tweet.url} tweet={tweet} />
            ))}
        </div>
    )
}

// =============================================================================
// Column Building Logic
// =============================================================================

/**
 * Categorizes tweets and builds columns with even distribution.
 *
 * Categories:
 * - Featured: tweets with photos or videos (1 per column)
 * - Standard: longer text tweets (2 per column)
 * - Tiny: short text tweets under 100 chars (3 per column)
 *
 * Distribution algorithm ensures variety throughout the carousel
 * by spreading each category evenly across all positions.
 */
const buildColumns = (tweets: Tweet[]): ColumnType[] => {
    if (!tweets || tweets.length === 0) return []

    // Categorize tweets by media type and content length
    const photo: Tweet[] = []
    const video: Tweet[] = []
    const standard: Tweet[] = []
    const tiny: Tweet[] = []

    for (const tweet of tweets) {
        const hasPhoto = tweet.media?.some((m) => m.type === 'photo')
        const hasVideo = tweet.media?.some((m) => m.type === 'video')
        const contentLength = tweet.content?.length ?? 0

        if (hasVideo) {
            video.push(tweet)
        } else if (hasPhoto) {
            photo.push(tweet)
        } else if (contentLength < TINY_CONTENT_THRESHOLD) {
            tiny.push(tweet)
        } else {
            standard.push(tweet)
        }
    }

    // Only use tiny columns if we have complete sets of 3
    const completeTinySets = Math.floor(tiny.length / 3)
    tiny.length = completeTinySets * 3

    // Build column arrays for each type
    const photoColumns: ColumnType[] = photo.map((t) => ({ type: 'featured' as const, tweet: t }))
    const videoColumns: ColumnType[] = video.map((t) => ({ type: 'featured' as const, tweet: t }))

    const standardColumns: ColumnType[] = []
    for (let i = 0; i < standard.length; i += 2) {
        const tweets = [standard[i]]
        if (i + 1 < standard.length) tweets.push(standard[i + 1])
        standardColumns.push({ type: 'standard', tweets })
    }

    const tinyColumns: ColumnType[] = []
    for (let i = 0; i + 2 < tiny.length; i += 3) {
        tinyColumns.push({ type: 'tiny', tweets: [tiny[i], tiny[i + 1], tiny[i + 2]] })
    }

    // Calculate total and distribute evenly
    const totalColumns = photoColumns.length + videoColumns.length + standardColumns.length + tinyColumns.length
    if (totalColumns === 0) return []

    const columns: ColumnType[] = new Array(totalColumns)

    /**
     * Distributes items evenly across the carousel using proportional spacing.
     * Different offsets prevent clustering of similar column types.
     */
    const distributeEvenly = (items: ColumnType[], offset: number) => {
        if (items.length === 0) return
        const step = totalColumns / items.length
        for (let i = 0; i < items.length; i++) {
            let pos = Math.floor(i * step + offset) % totalColumns
            while (columns[pos] !== undefined) {
                pos = (pos + 1) % totalColumns
            }
            columns[pos] = items[i]
        }
    }

    // Distribute each type with different offsets for variety
    distributeEvenly(photoColumns, 0)
    distributeEvenly(standardColumns, 1)
    distributeEvenly(videoColumns, 2)
    distributeEvenly(tinyColumns, 3)

    return columns.filter(Boolean)
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Wall of Love - Infinite scrolling carousel of curated tweets.
 *
 * Features:
 * - Auto-scrolling marquee with pause on hover
 * - Three card types: featured (media), standard (text), tiny (short)
 * - Even distribution of card types for visual variety
 * - Lazy loaded images with fallbacks
 * - Links open in new tab
 */
export const TweetCarousel = () => {
    const columns = useMemo(() => buildColumns(TWEETS), [])

    if (columns.length === 0) return null

    return (
        <section className="w-full bg-primary-1 pb-10 pt-12 md:pb-14 md:pt-16">
            <div className="mx-auto max-w-7xl px-4 pb-8">
                <h2 className="font-roboto-flex-extrabold text-center text-[4rem] font-extraBlack text-n-1 lg:text-headingMedium">
                    WALL OF LOVE
                </h2>
                <p className="mt-3 text-center text-base text-n-1 md:text-xl">
                    See what people are saying about Peanut on{' '}
                    <a
                        href="https://twitter.com/search?q=%40joinpeanut"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold underline"
                    >
                        Twitter/X
                    </a>
                </p>
            </div>

            <div className="overflow-hidden pb-2">
                <Marquee speed={MARQUEE_SPEED} pauseOnHover gradient={false} autoFill>
                    {columns.map((col, i) => (
                        <Column key={i} column={col} />
                    ))}
                </Marquee>
            </div>
        </section>
    )
}

export default TweetCarousel
