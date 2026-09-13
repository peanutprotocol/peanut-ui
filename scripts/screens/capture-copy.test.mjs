import assert from 'node:assert/strict'
import test from 'node:test'
import { localizedCaptureText } from './capture-copy.mjs'

test('capture checkpoints follow the merged app locale catalogs', () => {
    const expected = {
        en: ['Continue', 'Start Spending', 'Earn from invites'],
        'es-419': ['Continuar', 'Empezar a gastar', 'Gana con tus invitaciones'],
        'es-AR': ['Continuar', 'Empezar a gastar', 'Ganá con tus invitaciones'],
        'pt-BR': ['Continuar', 'Começar a gastar', 'Ganhe com convites'],
    }
    for (const [locale, [continueText, spendingText, inviteText]] of Object.entries(expected)) {
        const text = localizedCaptureText(locale)
        assert.equal(text('Continue'), continueText)
        assert.equal(text('Start Spending'), spendingText)
        assert.equal(text('Earn from invites'), inviteText)
    }
})

test('unknown capture strings remain unchanged', () => {
    assert.equal(localizedCaptureText('pt-BR')('Synthetic account'), 'Synthetic account')
})
