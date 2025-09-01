import {CraftData, CraftDescriptor, Resp} from 'logisheets-craft-forge'
import {Result, ResultAsync, err, ok} from '../../error'

export interface Client {
    getUserId(baseUrl: string): ResultAsync<string>
    getId(baseUrl: string): ResultAsync<string>
    downloadDescriptor(
        baseUrl: string,
        id: string
    ): ResultAsync<CraftDescriptor>

    uploadDescriptor(
        baseUrl: string,
        id: string,
        descriptor: CraftDescriptor
    ): ResultAsync<string>

    downloadCraftData(baseUrl: string, id: string): ResultAsync<CraftData>

    uploadCraftData(
        baseUrl: string,
        id: string,
        data: CraftData
    ): ResultAsync<void>
}

export class ClientImpl implements Client {
    private _userId?: string

    async getUserId(baseUrl: string): ResultAsync<string> {
        if (this._userId) return ok(this._userId)

        const url = `${baseUrl.replace(/\/$/, '')}/user_id`
        const res = await fetch(url)
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        const result = (await res.json()) as Resp<string>
        const r = toResult(result)
        if (r.isOk()) {
            this._userId = r._unsafeUnwrap()
        }
        return r
    }

    async getId(baseUrl: string): ResultAsync<string> {
        const url = `${baseUrl.replace(/\/$/, '')}/id`
        const res = await fetch(url)
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        const result = (await res.json()) as Resp<string>
        return toResult(result)
    }

    async downloadDescriptor(url: string): ResultAsync<CraftDescriptor> {
        const res = await fetch(url)
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        const result = (await res.json()) as Resp<CraftDescriptor>
        return toResult(result)
    }

    async uploadDescriptor(
        baseUrl: string,
        id: string,
        descriptor: CraftDescriptor
    ): ResultAsync<string> {
        const url = `${baseUrl.replace(
            /\/$/,
            ''
        )}/descriptor/${encodeURIComponent(id)}`
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(descriptor),
        })
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        return ok(url)
    }

    async downloadCraftData(
        baseUrl: string,
        id: string
    ): ResultAsync<CraftData> {
        const url = `${baseUrl.replace(/\/$/, '')}/data/${encodeURIComponent(
            id
        )}`
        const res = await fetch(url)
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        const result = (await res.json()) as Resp<CraftData>
        return toResult(result)
    }

    async uploadCraftData(
        baseUrl: string,
        id: string,
        data: CraftData
    ): ResultAsync<void> {
        const url = `${baseUrl.replace(/\/$/, '')}/data/${encodeURIComponent(
            id
        )}`
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        })
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        return ok(undefined)
    }

    private _userName?: string
}

function toResult<T>(resp: Resp<T>): Result<T> {
    if (resp.data === undefined) {
        return err({
            message: resp.message ?? 'unknown error',
            code: resp.statusCode,
        })
    }
    return ok(resp.data)
}
