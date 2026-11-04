import { rememberCardAddedOnThisDevice, wasCardAddedOnThisDevice } from '@/utils/wallet-added-cards'

beforeEach(() => window.localStorage.clear())

it('remembers only the cards this device added', () => {
    rememberCardAddedOnThisDevice('card-1')
    expect(wasCardAddedOnThisDevice('card-1')).toBe(true)
    expect(wasCardAddedOnThisDevice('card-2')).toBe(false)
})

it('keeps the most recent cards and drops the oldest', () => {
    for (let i = 0; i < 12; i++) rememberCardAddedOnThisDevice(`card-${i}`)
    expect(wasCardAddedOnThisDevice('card-0')).toBe(false)
    expect(wasCardAddedOnThisDevice('card-1')).toBe(false)
    expect(wasCardAddedOnThisDevice('card-2')).toBe(true)

    // Adding a card again makes it the newest, so the next one pushes out card-3.
    rememberCardAddedOnThisDevice('card-2')
    rememberCardAddedOnThisDevice('card-12')
    expect(wasCardAddedOnThisDevice('card-3')).toBe(false)
    expect(wasCardAddedOnThisDevice('card-2')).toBe(true)
    expect(wasCardAddedOnThisDevice('card-12')).toBe(true)
})

it('treats an unreadable record as empty', () => {
    window.localStorage.setItem('peanut:walletAddedCards', '{not json')
    expect(wasCardAddedOnThisDevice('card-1')).toBe(false)
    window.localStorage.setItem('peanut:walletAddedCards', JSON.stringify({ card: 'card-1' }))
    expect(wasCardAddedOnThisDevice('card-1')).toBe(false)
    rememberCardAddedOnThisDevice('card-1')
    expect(wasCardAddedOnThisDevice('card-1')).toBe(true)
})
