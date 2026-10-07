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
        'es-419': ['Continuar', 'Agrega un correo para continuar', 'Gana con tus invitaciones'],
        'es-AR': ['Continuar', 'Agregá un correo para continuar', 'Ganá con tus invitaciones'],
        'pt-BR': ['Continuar', 'Adicione um e-mail para continuar', 'Ganhe com convites'],
    }
    for (const [locale, [continueText, emailText, inviteText]] of Object.entries(expected)) {
        const text = localizedCaptureText(locale, source)
        assert.equal(text('Continue'), continueText)
        assert.equal(text('Add email to continue'), emailText)
        assert.equal(text('Earn from invites'), inviteText)
    }
})

// p72 opens the fold on the profile Accounts page in every capture locale
test('the open-an-account fold is clicked by its localized name', () => {
    const expected = {
        en: 'Open new account',
        'es-419': 'Abrir cuenta nueva',
        'es-AR': 'Abrir cuenta nueva',
        'pt-BR': 'Abrir nova conta',
    }
    for (const [locale, label] of Object.entries(expected)) {
        assert.equal(localizedCaptureText(locale, source)('Open new account'), label)
    }
})

test('unknown capture strings remain unchanged', () => {
    assert.equal(localizedCaptureText('pt-BR', source)('Synthetic account'), 'Synthetic account')
})

test('the network drawer opens by its localized label in every app locale', () => {
    for (const [locale, label] of Object.entries({
        en: 'More networks',
        'es-419': 'Más redes',
        'es-AR': 'Más redes',
        'pt-BR': 'Mais redes',
    }))
        assert.equal(localizedCaptureText(locale, source)('More networks'), label)
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
