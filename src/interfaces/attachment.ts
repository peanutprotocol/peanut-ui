/**
 * shared attachment options type used across payment flows
 *
 * allows users to attach a message and/or file to payments.
 * fileUrl is the uploaded url, rawFile is the original file object.
 */
export interface IAttachmentOptions {
    fileUrl: string | undefined
    message: string | undefined
    rawFile: File | undefined
}
