import Select from 'react-select'
import {FC} from 'react'
import type {Props} from 'react-select'
export {Props as SelectProps}

export const SelectComponent: FC<Props> = (props) => {
    return <Select {...props} />
}
