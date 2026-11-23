import { isTrackedLinkEntry } from '../eligibility'

const entry = (url: string) => {
    const { pathname, search } = new URL(url, 'https://peanut.me')
    return isTrackedLinkEntry({ pathname, search })
}

it('keeps the /app handoff and the legacy code as tracked entries', () => {
    expect(entry('/app?tl=a&acq_invite=a')).toBe(true)
    expect(entry('/app/?code=Alice')).toBe(true)
    expect(entry('/app')).toBe(false)
    expect(entry('/home?tl=a')).toBe(false)
})
