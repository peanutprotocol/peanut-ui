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
        en: ['Continue', 'Add email to continue', 'Earn from invites'],
        'es-419': ['Continuar', 'Agrega un correo para continuar', 'Gana con invitaciones'],
        'es-AR': ['Continuar', 'Agregá un correo para continuar', 'Ganá con invitaciones'],
        'pt-BR': ['Continuar', 'Adicione um e-mail para continuar', 'Ganhe com convites'],
    }
    for (const [locale, [continueText, emailText, inviteText]] of Object.entries(expected)) {
        const text = localizedCaptureText(locale, source)
        assert.equal(text('Continue'), continueText)
        assert.equal(text('Add email to continue'), emailText)
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
