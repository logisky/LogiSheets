import { ChangeEvent, FC, useRef } from 'react'
import styles from './file.module.scss'
import { getU8 } from '@/core/file'
import { Backend, SheetService } from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'
import {useToast} from '@/ui/notification/useToast'

export type FileProps = Record<string, unknown>

export const FileComponent: FC<FileProps> = () => {
    const fileId = useRef(1)
    const backendSvc = useInjection<Backend>(TYPES.Backend)
    const dataSvc = useInjection<SheetService>(TYPES.Sheet)
    const upload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.item(0)
        if (!file)
            return
        const readFile = new Promise((resolve, reject) => {
            getU8(file).subscribe(async u8 => {
                if (!u8) {
                    reject('read file error')
                    return
                }
                dataSvc.clearAllData()
                backendSvc.send({
                    $case: 'openFile',
                    openFile: {
                        content: u8,
                        fileId: `${fileId.current++}`,
                        name: file.name
                    }
                })
                resolve('')
            }, err => {
                reject(err)
            })
        })
        useToast().toast.promise(readFile, {
            pending: 'Loading file...',
            error: 'Read file error, retry later',
            success: `Read file ${file.name}`,
        })
    }
    return (<div className={styles.host}>
        <input type="file" name='file' onChange={e => upload(e)} />
    </div>)
}