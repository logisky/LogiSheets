import { ChangeEvent, FC } from 'react'
import styles from './file.module.scss'
import { getU8 } from '@/common/file'
import { Backend } from '@/core/data'
import { useInjection } from '@/core/ioc/provider'
import { TYPES } from '@/core/ioc/types'
// TODO: 挪到DataService中
let FILE_ID = 1

export interface FileProps {

}

export const FileComponent: FC<FileProps> = () => {
    const BACKEND_SERVICE = useInjection<Backend>(TYPES.Backend)
	const upload = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.item(0)
		if (!file)
			return
		getU8(file).subscribe(async u8 => {
			if (!u8) {
				alert('read file error')
				return
			}
			BACKEND_SERVICE.send({
				$case: 'openFile',
				openFile: {
					content: u8,
					fileId: `${FILE_ID++}`,
					name: file.name
				}
			})
		}, err => {
			console.log(err)
		})
	}
	return (<div className={styles.host}>
		<input type="file" name='file' onChange={e => upload(e)} />
	</div>)
}