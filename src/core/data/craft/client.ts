import {CraftData, CraftDescriptor} from 'logisheets-craft-forge'

export interface Client {
    getId(baseUrl: string): Promise<string>
    downloadDescriptor(baseUrl: string, id: string): Promise<CraftDescriptor>

    uploadDescriptor(
        baseUrl: string,
        id: string,
        descriptor: CraftDescriptor
    ): Promise<void>

    downloadCraftData(baseUrl: string, id: string): Promise<CraftData>

    uploadCraftData(baseUrl: string, id: string, data: CraftData): Promise<void>
}

export class ClientImpl implements Client {
    async getId(baseUrl: string): Promise<string> {
        const url = `${baseUrl.replace(/\/$/, '')}/id/`
        const res = await fetch(url)
        if (!res.ok) {
            throw new Error(`Failed to fetch id: ${res.statusText}`)
        }
        return res.text()
    }

    async downloadDescriptor(
        baseUrl: string,
        id: string
    ): Promise<CraftDescriptor> {
        const url = `${baseUrl.replace(
            /\/$/,
            ''
        )}/descriptor/${encodeURIComponent(id)}`
        const res = await fetch(url)
        if (!res.ok) {
            if (res.status === 404)
                throw new Error(`Descriptor not found: ${id}`)
            throw new Error(`Failed to fetch descriptor: ${res.statusText}`)
        }
        return res.json()
    }

    async uploadDescriptor(
        baseUrl: string,
        id: string,
        descriptor: CraftDescriptor
    ): Promise<void> {
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
            throw new Error(`Failed to upload descriptor: ${res.statusText}`)
        }
    }

    async downloadCraftData(baseUrl: string, id: string): Promise<CraftData> {
        const url = `${baseUrl.replace(/\/$/, '')}/data/${encodeURIComponent(
            id
        )}`
        const res = await fetch(url)
        if (!res.ok) {
            if (res.status === 404)
                throw new Error(`CraftData not found: ${id}`)
            throw new Error(`Failed to fetch craft data: ${res.statusText}`)
        }
        return res.json()
    }

    async uploadCraftData(
        baseUrl: string,
        id: string,
        data: CraftData
    ): Promise<void> {
        const url = `${baseUrl.replace(/\/$/, '')}/data/${encodeURIComponent(
            id
        )}`
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        })
        if (!res.ok) {
            throw new Error(`Failed to upload craft data: ${res.statusText}`)
        }
    }
}
