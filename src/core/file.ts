import { Observable } from 'rxjs'
import { isArrayBuffer } from './type-guard'
export function getBase64(file: File) {
    const reader = new FileReader()
    return new Observable<string | null>((result => {
        reader.onerror = e => result.error(e)
        reader.onabort = e => result.error(e)
        reader.onload = () => result.next(reader.result as string)
        reader.onloadend = () => result.complete()
        reader.readAsDataURL(file)
    }))
}
export function getU8(file: File) {
    const reader = new FileReader()
    return new Observable<Uint8Array | null>((result => {
        reader.onerror = e => result.error(e)
        reader.onabort = e => result.error(e)
        reader.onload = () => {
            const r = reader.result
            if (!isArrayBuffer(r))
                throw Error('not arraybuffer')
            result.next(new Uint8Array(r))
        }
        reader.onloadend = () => result.complete()
        reader.readAsArrayBuffer(file)
    }))
}