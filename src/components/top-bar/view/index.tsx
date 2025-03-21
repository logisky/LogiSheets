import {SelectedData} from '@/components/canvas'
import ToggleButton from '@mui/material/ToggleButton'
import styles from '../content/start.module.scss'
import {freezeCellIcon} from './icons'

export interface ViewProps {
    readonly selectedData?: SelectedData
}

export const ViewComponent = ({selectedData}: ViewProps) => {
    return (
        <div className={styles['host']}>
            <ToggleButton
                value="freeze-cell"
                size="small"
                aria-label="freeze-cell"
                style={{fontSize: '1.5rem'}}
            >
                {freezeCellIcon()}
            </ToggleButton>
        </div>
    )
}
