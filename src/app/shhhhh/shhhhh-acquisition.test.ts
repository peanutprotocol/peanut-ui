import {
    queueShhhhhCampaignContinuation,
    settleShhhhhCampaignContinuation,
    shhhhhCampaignSignupRoute,
} from './shhhhh-acquisition'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'

beforeEach(() => localStorage.clear())

it('keeps a public card destination through campaign signup without waiting for an award', () => {
    queueShhhhhCampaignContinuation()
    expect(getRedirectUrl()).toBe('/card')
    expect(shhhhhCampaignSignupRoute()).toBe('/setup?step=signup&redirect_uri=%2Fcard')
})

it('continues an old in-flight signup marker to the public card', () => {
    saveToLocalStorage('redirect', '/home?badge_campaign_continuation=shhhhh')
    expect(settleShhhhhCampaignContinuation()).toBe('/card')
    expect(getRedirectUrl()).toBe('/card')
    expect(settleShhhhhCampaignContinuation()).toBe('/card')
})

it('preserves unrelated signup destinations', () => {
    saveToLocalStorage('redirect', '/home')
    expect(settleShhhhhCampaignContinuation()).toBeUndefined()
    expect(getRedirectUrl()).toBe('/home')
})
