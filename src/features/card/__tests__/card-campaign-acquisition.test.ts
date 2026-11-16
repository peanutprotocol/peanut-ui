import {
    cardCampaignSignupRoute,
    queueCardCampaignContinuation,
    settleCardCampaignContinuation,
} from '../card-campaign-acquisition'
import { getRedirectUrl, saveToLocalStorage } from '@/utils/general.utils'

beforeEach(() => localStorage.clear())

it('keeps a card destination through campaign signup without waiting for an award', () => {
    queueCardCampaignContinuation()
    expect(getRedirectUrl()).toBe('/card')
    expect(cardCampaignSignupRoute()).toBe('/setup?step=signup&redirect_uri=%2Fcard')
})

it('continues an old in-flight /shhhhh signup marker to the card', () => {
    saveToLocalStorage('redirect', '/home?badge_campaign_continuation=shhhhh')
    expect(settleCardCampaignContinuation()).toBe('/card')
    expect(getRedirectUrl()).toBe('/card')
    expect(settleCardCampaignContinuation()).toBe('/card')
})

it('preserves unrelated signup destinations', () => {
    saveToLocalStorage('redirect', '/home')
    expect(settleCardCampaignContinuation()).toBeUndefined()
    expect(getRedirectUrl()).toBe('/home')
})
