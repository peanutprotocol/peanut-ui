/**
 * Shared TypeScript interfaces for Quest components
 */

export interface LeaderboardEntry {
    rank: number
    userId: string
    username: string
    metric: number
    badge?: string
}

export interface QuestLeaderboardData {
    leaderboard: LeaderboardEntry[]
    userStatus?: {
        metric: number
    }
}

export interface AllQuestsLeaderboardData {
    most_invites: QuestLeaderboardData
    bank_drainer: QuestLeaderboardData
    biggest_pot: QuestLeaderboardData
}
