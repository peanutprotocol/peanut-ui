import { APP_LOCALES } from '../config'
import { loadMessages } from '../messages'

it.each(APP_LOCALES)('has complete EURC account copy in %s', async (locale) => {
    const english = (await loadMessages('en')).currencyAccounts
    const actual = (await loadMessages(locale)).currencyAccounts
    for (const key of Object.keys(english) as Array<keyof typeof english>) {
        expect(typeof actual[key]).toBe('string')
        expect(actual[key].trim().length).toBeGreaterThan(0)
        if (locale !== 'en') expect(actual[key]).not.toBe(english[key])
    }
})
