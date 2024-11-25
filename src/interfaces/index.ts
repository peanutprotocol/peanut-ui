export * from './interfaces'

export interface User {
    userId: string
    email?: string
    username?: string
    full_name?: string
    bridge_customer_id?: string
    kycStatus?: 'verified' | 'pending' | 'rejected' | undefined
    profile_picture?: string
}

export interface Account {
    account_id: string
    account_identifier: string
    account_type: string
    bridge_account_id?: string
    account_details?: string // JSON string containing address details
}

export interface IUserProfile {
    points: number
    transactions: any[]
    referralsPointsTxs: any[]
    totalReferralConnections: number
    referredUsers: number
    streak: number
    accounts: Account[]
    contacts: any[]
    totalPoints: number
    user: User
}

export interface IResponse {
    success: boolean
    data: any
    message?: string
}
