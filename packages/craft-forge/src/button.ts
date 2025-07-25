import {BlockId, SheetId} from './app/types'

export enum DiyCellButtonType {
    // Upload all the key-value pairs to the server
    Upload,
    // Download all the key-value pairs from the server
    Download,
    Image,
}

export interface DiyButtonConfig {
    type: DiyCellButtonType
}

export interface UploadButtonConfig extends DiyButtonConfig {
    url: string
    type: DiyCellButtonType.Upload
}

export interface DownloadButtonConfig extends DiyButtonConfig {
    url: string
    type: DiyCellButtonType.Download
}
