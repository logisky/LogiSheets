import {
    DiyButtonConfig,
    DiyCellButtonType,
    UploadButtonConfig,
    DownloadButtonConfig,
} from 'logisheets-craft-forge'

export class DiyButtonManager {
    public registerDiyButton(diyId: number, config: DiyButtonConfig) {
        this._configs.set(diyId, config)
    }

    public getDiyButtonType(diyId: number): DiyCellButtonType | undefined {
        const config = this._configs.get(diyId)
        if (!config) return undefined
        return config.type
    }

    public getUploadButtonConfig(
        diyId: number
    ): UploadButtonConfig | undefined {
        const config = this._configs.get(diyId)
        if (!config) return undefined
        if (config.type !== DiyCellButtonType.Upload) return undefined
        return config as UploadButtonConfig
    }

    public getDownloadButtonConfig(
        diyId: number
    ): DownloadButtonConfig | undefined {
        const config = this._configs.get(diyId)
        if (!config) return undefined
        if (config.type !== DiyCellButtonType.Download) return undefined
        return config as DownloadButtonConfig
    }

    private _configs: Map<number, DiyButtonConfig> = new Map()
}
