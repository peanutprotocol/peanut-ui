import en from '../messages/en.json'

// Mirrors badge:check in peanut-api-ts: the earner reads `description` ("you"),
// a profile visitor reads `publicDescription` ("they" or person-neutral).
describe('badges.catalog grammatical person', () => {
    it.each(Object.entries(en.badges.catalog))('%s', (_code, copy) => {
        expect(copy.description).not.toMatch(/\b(they|them|their|theirs)\b/i)
        expect(copy.publicDescription).not.toMatch(/\b(you|your|yours)\b/i)
    })
})
