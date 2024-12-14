import {ToastContainer, ToastContainerProps} from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {FC} from 'react'

export type NotificationProps = ToastContainerProps

export const NotificatonComponent: FC<NotificationProps> = (props) => {
    return (
        <ToastContainer
            autoClose={2000}
            position={'top-center'}
            hideProgressBar
            newestOnTop={false}
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            {...props}
        />
    )
}
