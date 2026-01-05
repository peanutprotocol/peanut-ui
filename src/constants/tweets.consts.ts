/**
 * @joinpeanut Wall of Love
 *
 * Curated third-party mentions from X (Twitter) during Devconnect Buenos Aires.
 *
 * @dataset
 * - Date range: Oct 1 – Nov 26, 2025
 * - Count: ~140 unique posts
 * - Filters: Excludes team posts, neutral mentions, bots
 *
 * @scoring impact_score (0.55–0.99)
 * - 60% content quality (enthusiasm, specificity, authenticity)
 * - 30% author influence (followers, verified status, known builder/VC/EF)
 * - 10% engagement signals
 * - Caps: Internal team posts ≤0.55, low-effort posts ≤0.62
 *
 * @usage
 * Sorted descending by impact_score for carousel display.
 * Update quarterly by re-running collection with same criteria.
 *
 * @recreation Use Grok (has native X search access):
 *
 *   "Search X for positive third-party mentions of @joinpeanut from [DATE_START] to [DATE_END].
 *    Exclude team posts (@uwwgo, @0xkkonrad, @andxqueen), neutral mentions, and bots.
 *    For each post return: url, author, handle, content, verified, followers_count, avatar, timestamp.
 *    Add impact_score (0.60–0.98): 60% enthusiasm + 30% influence + 10% engagement.
 *    Cap bots at 0.65, boost EF/Arbitrum/known devs. Sort by impact_score desc.
 *    Return as JSON array."
 *
 *   If truncated, ask for batches ("top 50", then "remaining entries").
 *
 * @lastUpdated 2025-11-26
 */

export interface TweetMedia {
    type: 'photo' | 'video'
    url: string
}

export interface Tweet {
    url: string
    author: string
    handle: string
    content: string
    timestamp?: string
    verified?: boolean
    followers_count?: number
    avatar?: string
    impact_score?: number
    is_reply?: boolean
    reply_to_url?: string | null
    media?: TweetMedia[]
}

interface TweetsData {
    total_positive_mentions: number
    date_range: string
    scoring: string
    note: string
    tweets: Tweet[]
}

// Load tweets from tweets.json (same folder)
import tweetsJson from './tweets.json'

const MAX_TWEETS = 100
const MAX_PER_AUTHOR = 3

const tweetsData = tweetsJson as TweetsData

/** All tweets from dataset, sorted by impact_score desc */
export const ALL_TWEETS: Tweet[] = tweetsData.tweets

/** Filtered tweets for carousel: top 100, max 3 per author */
export const TWEETS: Tweet[] = (() => {
    const authorCount = new Map<string, number>()
    const filtered: Tweet[] = []

    for (const tweet of ALL_TWEETS) {
        const count = authorCount.get(tweet.handle) || 0
        if (count >= MAX_PER_AUTHOR) continue

        authorCount.set(tweet.handle, count + 1)
        filtered.push(tweet)

        if (filtered.length >= MAX_TWEETS) break
    }

    return filtered
})()
