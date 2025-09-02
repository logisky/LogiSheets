import {CraftData, CraftDescriptor, Resp} from 'logisheets-craft-forge'
import {Result, ResultAsync, err, ok} from '../../error'

export interface Client {
    getUserId(): ResultAsync<string>
    getId(): ResultAsync<string>
    downloadDescriptor(id: string): ResultAsync<CraftDescriptor>

    uploadDescriptor(
        id: string,
        descriptor: CraftDescriptor
    ): ResultAsync<string>

    downloadCraftData(id: string): ResultAsync<CraftData[]>

    uploadCraftData(id: string, data: CraftData): ResultAsync<void>
}

export class ClientImpl implements Client {
    public constructor(public baseUrl: string) {}

    public isSameHost(url: string): boolean {
        return new URL(this.baseUrl).host === new URL(url).host
    }

    private _userId?: string

    async getUserId(): ResultAsync<string> {
        if (this._userId) return ok(this._userId)

        const url = `${this.baseUrl.replace(/\/$/, '')}/user_id`
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

    async getId(): ResultAsync<string> {
        const url = `${this.baseUrl.replace(/\/$/, '')}/id`
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
        id: string,
        descriptor: CraftDescriptor
    ): ResultAsync<string> {
        const url = `${this.baseUrl.replace(
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

    async downloadCraftData(id: string): ResultAsync<CraftData[]> {
        if (!this._userId) {
            const userIdResult = await this.getUserId()
            if (userIdResult.isErr())
                return err(userIdResult._unsafeUnwrapErr())
            this._userId = userIdResult._unsafeUnwrap()
        }
        const url = `${this.baseUrl.replace(
            /\/$/,
            ''
        )}/data/${encodeURIComponent(id)}/${encodeURIComponent(this._userId)}`
        const res = await fetch(url)
        if (!res.ok) {
            return err({
                message: 'http error',
                code: res.status,
            })
        }
        const result = (await res.json()) as Resp<CraftData[]>
        return toResult(result)
    }

    async uploadCraftData(id: string, data: CraftData): ResultAsync<void> {
        if (!this._userId) {
            const userIdResult = await this.getUserId()
            if (userIdResult.isErr())
                return err(userIdResult._unsafeUnwrapErr())
            this._userId = userIdResult._unsafeUnwrap()
        }
        const url = `${this.baseUrl.replace(
            /\/$/,
            ''
        )}/data/${encodeURIComponent(id)}/${encodeURIComponent(this._userId)}`
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
