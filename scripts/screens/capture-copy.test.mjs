import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localizedCaptureText } from './capture-copy.mjs'

const source = fileURLToPath(new URL('../../', import.meta.url))

test('capture checkpoints follow the merged app locale catalogs', () => {
    const expected = {
        en: ['Continue', 'Start Spending', 'Earn from invites'],
        'es-419': ['Continuar', 'Empezar a gastar', 'Gana con tus invitaciones'],
        'es-AR': ['Continuar', 'Empezar a gastar', 'Ganá con tus invitaciones'],
        'pt-BR': ['Continuar', 'Começar a gastar', 'Ganhe com convites'],
    }
    for (const [locale, [continueText, spendingText, inviteText]] of Object.entries(expected)) {
        const text = localizedCaptureText(locale, source)
        assert.equal(text('Continue'), continueText)
        assert.equal(text('Start Spending'), spendingText)
        assert.equal(text('Earn from invites'), inviteText)
    }
})

test('unknown capture strings remain unchanged', () => {
    assert.equal(localizedCaptureText('pt-BR', source)('Synthetic account'), 'Synthetic account')
})

test('capture copy is read from the requested source checkout', () => {
    const targetSource = mkdtempSync(join(tmpdir(), 'capture-copy-'))
    const messages = join(targetSource, 'src/i18n/app/messages')
    mkdirSync(messages, { recursive: true })
    writeFileSync(join(messages, 'en.json'), JSON.stringify({ common: { continue: 'Target Continue' } }))
    try {
        assert.equal(localizedCaptureText('en', targetSource)('Continue'), 'Target Continue')
    } finally {
        rmSync(targetSource, { recursive: true, force: true })
    }
})
