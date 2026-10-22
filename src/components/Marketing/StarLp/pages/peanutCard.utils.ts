/** `phrase` inside `text` with no-break spaces, so a line never breaks inside it. */
export function keepTogether(text: string, phrase: string): string {
    return text.replace(phrase, phrase.replace(/ /g, ' '))
}
