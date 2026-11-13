let available = true

export function consumeLandingAutoLogin(): boolean {
    const consumed = available
    available = false
    return consumed
}

export function disableLandingAutoLogin(): void {
    available = false
}
