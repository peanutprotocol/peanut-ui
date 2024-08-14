import crypto from 'crypto'

export const hashPassword = (
    password: string
): {
    salt: string
    hash: string
} => {
    const salt = crypto.randomBytes(16).toString('hex')

    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')

    return { salt, hash }
}

export const validatePassword = ({ password, salt, hash }: { password: string; salt: string; hash: string }) => {
    const hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return hash === hashVerify
}
