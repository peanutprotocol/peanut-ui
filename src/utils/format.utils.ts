export const sanitizeBankAccount = (value: string) => {
    return value.replace(/[\s\-\._]/g, '').toLowerCase()
}

export const formatIBANDisplay = (value: string) => {
    return value
        .toUpperCase()
        .replace(/(.{4})/g, '$1 ')
        .trim()
}

export const formatUSAccountDisplay = (value: string) => {
    return value.toUpperCase()
}
