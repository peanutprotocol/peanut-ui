# Screen wordiness budget

`node scripts/screen-wordiness.mjs --check` runs in CI (`screen-wordiness` job). It prints the heaviest screens on every PR. It fails when a screen grows past its entry in `screen-wordiness-baseline.json`, or when a screen with no entry goes over the budget (60). The benchmark is about 20 words per screen.

- **Screen**: each app `page.tsx` (marketing, dev and redirect routes are out), plus each `*Screen.tsx`, `*View.tsx`, `*.view.tsx`, `*Modal.tsx`, `*Drawer.tsx` and `*Sheet.tsx` component. A screen owns the `.tsx` components it imports directly, the components those import, and below that only components in the same feature folder. The walk stops at other screens and at `components/0_Bruddle` and `components/Global`.
- **Score**: English words from `src/i18n/app/messages/en.json` for every key the screen's files use through `t('…')`, `t.rich` or `t.markup`, once per key, plus literal JSX text and literal `title`/`label`/`description`-style props. An `{arg}` is one word. A plural or select counts its longest branch. A template key (`` t(`status.${s}`) ``) counts its heaviest match. Words inside a `<Callout>` count twice.
- **Limits**: the score adds every state a screen can show (error, loading, success), so it is a copy surface, not one frame. Keys built in `.ts` helpers, or passed in as variables, are not counted.
- **Update**: after you cut copy, or after deliberate growth that you explain in the PR, run `node scripts/screen-wordiness.mjs --update-baseline`.
