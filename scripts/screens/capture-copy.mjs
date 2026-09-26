import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['en', 'es-419', 'es-AR', 'pt-BR']
const COPY_PATHS = new Map([
    ['Continue', 'common.continue'],
    ['What if I lose my phone?', 'profile.backup.faq.losePhone'],
    ['What if I change phone?', 'profile.backup.faq.changePhone'],
    ["Why can't I export my private key?", 'profile.backup.faq.exportKeys'],
    ['Add email to continue', 'kyc.provideEmail.title'],
    ['Camera access needed', 'global.qrScanner.cameraPermission.title'],
    ['Earn from invites', 'global.earlyUserModal.title'],
    ["Chat couldn't load", 'global.supportDrawer.chatLoadFailed'],
    ['A small update to our terms', 'global.reConsent.title'],
    ['Open new account', 'depositAccounts.list.openTitle'],
])

const read = (source, locale) =>
    JSON.parse(readFileSync(join(source, 'src/i18n/app/messages', `${locale}.json`), 'utf8'))

const merge = (base, override) => {
    const result = { ...base }
    for (const [key, value] of Object.entries(override)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            result[key] &&
            typeof result[key] === 'object'
        )
            result[key] = merge(result[key], value)
        else if (value !== null && value !== undefined) result[key] = value
    }
    return result
}

const messagesFor = (locale, source) => {
    if (!LOCALES.includes(locale)) throw new Error(`Unsupported capture locale: ${locale}`)
    const english = read(source, 'en')
    if (locale === 'en') return english
    const regional = merge(english, read(source, locale === 'es-AR' ? 'es-419' : locale))
    return locale === 'es-AR' ? merge(regional, read(source, 'es-AR')) : regional
}

const get = (messages, path) => path.split('.').reduce((value, key) => value?.[key], messages)

export function localizedCaptureText(locale, source) {
    const messages = messagesFor(locale, source)
    const translations = new Map(
        [...COPY_PATHS]
            .map(([english, path]) => [english, get(messages, path)])
            .filter(([, value]) => typeof value === 'string')
    )
    return (text) => translations.get(text) ?? text
}
