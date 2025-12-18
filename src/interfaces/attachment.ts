// shared attachment options type used across payment flows
export interface IAttachmentOptions {
    fileUrl: string | undefined
    message: string | undefined
    rawFile: File | undefined
}
