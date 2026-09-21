/**
 * The stock Crisp launcher's show/hide lifecycle.
 *
 * The bug this guards against (2026-09-21): the marketing site's Crisp bubble
 * survived a client-side navigation into the app — same document, no reload,
 * and the widget's DOM lives outside React — and sat over the withdraw bank
 * form's last field and the QR button. The app has its own support drawer and
 * must never show the stock launcher.
 */
import { CRISP_WEBSITE_ID } from '@/constants/crisp'
import { hideCrispLauncher, loadCrispChatbox, showCrispLauncher } from '@/utils/crisp-launcher'

const SCRIPT_SELECTOR = 'script[src="https://client.crisp.chat/l.js"]'

const queued = () => (window.$crisp ?? []) as unknown[][]

describe('crisp-launcher', () => {
    beforeEach(() => {
        window.$crisp = undefined
        document.head.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => el.remove())
    })

    it('queues show before l.js has loaded, rather than throwing on a missing $crisp', () => {
        expect(window.$crisp).toBeUndefined()

        showCrispLauncher()

        expect(queued()).toEqual([['do', 'chat:show']])
    })

    it('queues hide before l.js has loaded', () => {
        hideCrispLauncher()

        expect(queued()).toEqual([
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
    })

    it('closes the chatbox before hiding, so an open panel cannot ride into the app', () => {
        loadCrispChatbox()
        showCrispLauncher()
        hideCrispLauncher()

        expect(queued()).toEqual([
            ['do', 'chat:show'],
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
    })

    it('appends to an existing queue instead of replacing it', () => {
        window.$crisp = [['do', 'chat:open']]

        showCrispLauncher()

        expect(queued()).toEqual([
            ['do', 'chat:open'],
            ['do', 'chat:show'],
        ])
    })

    it('loads l.js once per document, so a re-run cannot boot a second widget', () => {
        loadCrispChatbox()
        loadCrispChatbox()

        expect(document.head.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1)
        expect(window.CRISP_WEBSITE_ID).toBe(CRISP_WEBSITE_ID)
    })
})
