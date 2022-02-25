import { FC } from 'react'
import styles from './suggest.module.scss'
export interface Details {
	close$: () => void
}
export const SuggestDetailsComponent: FC<Details> = ({
	close$,
}) => {
	return (<div className={styles.details}></div>)
}