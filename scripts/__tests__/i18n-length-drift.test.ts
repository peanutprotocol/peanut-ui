import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { measureDrift, visibleText } from '../i18n-length-drift-core.cjs'

describe('visibleText', () => {
    it('drops placeholders and rich-text tags', () => {
        expect(visibleText('Send {amount} to <b>{name}</b> now')).toBe('Send to now')
    })

    it('keeps only the longest plural or select branch', () => {
        expect(visibleText('{count, plural, one {# item} other {# items left}}')).toBe('items left')
    })
})

describe('measureDrift on a fixture tree', () => {
    let root: string
    const write = (rel: string, body: unknown) => {
        const file = join(root, rel)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, JSON.stringify(body))
    }
    const forLocale = (locale: string) => {
        const result = measureDrift(root).locales.find((l) => l.locale === locale)
        if (!result) throw new Error(`no result for ${locale}`)
        return result
    }

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), 'i18n-length-drift-'))
        write('src/i18n/app/messages/en.json', {
            card: {
                title: 'Your card',
                body: 'Pay anywhere with your card.',
                ok: 'OK',
                allowed: 'Sort code',
            },
        })
        write('src/i18n/app/messages/es-419.json', {
            card: {
                title: 'Tu tarjeta de pago virtual',
                body: 'Paga en cualquier lugar.',
                ok: 'De acuerdo',
                allowed: 'Código de banco (Sort Code)',
            },
        })
        // es-AR overrides nothing, so it inherits every es-419 string.
        write('src/i18n/app/messages/es-AR.json', {})
        // pt-BR has no `card.title`: that key renders English and is not compared.
        write('src/i18n/app/messages/pt-BR.json', { card: { body: 'Pague em qualquer lugar com seu cartão.' } })
        write('scripts/i18n-length-drift-allowlist.json', [
            { key: 'card.allowed', reason: 'The English term stays next to the translation.' },
            { key: 'card.gone', reason: 'Old entry.' },
        ])
    })

    afterAll(() => rmSync(root, { recursive: true, force: true }))

    it('flags drift over 30% and marks title keys, skipping short English and allowlisted keys', () => {
        const es = forLocale('es-419')
        expect(es.compared).toBe(3)
        expect(es.allowlisted).toBe(1)
        expect(es.flagged).toHaveLength(1)
        expect(es.flagged[0]).toMatchObject({ key: 'card.title', title: true, inherited: false })
        expect(es.flagged[0].drift).toBeCloseTo(26 / 9 - 1)
    })

    it('resolves es-AR through es-419 and marks the rows it inherits', () => {
        const ar = forLocale('es-AR')
        expect(ar.flagged.map((f) => [f.key, f.inherited])).toEqual([['card.title', true]])
    })

    it('compares only the keys a locale translates', () => {
        expect(forLocale('pt-BR').flagged.map((f) => f.key)).toEqual(['card.body'])
    })

    it('reports allowlist entries that no longer match a drifting key', () => {
        expect(measureDrift(root).staleAllowlist.map((e: { key: string }) => e.key)).toEqual(['card.gone'])
    })
})
