import React, {ErrorInfo} from 'react'
import i18n from '@/core/i18n/i18n'
import {useToast} from '@/ui/notification/useToast'
export interface IErrorBoundaryState {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

export interface IErrorBoundaryProps {
    children: React.ReactElement
}
export class ErrorBoundary extends React.Component<
    IErrorBoundaryProps,
    IErrorBoundaryState
> {
    constructor(props: IErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error: Error) {
        // Update state so the next render will show the fallback UI.
        return {
            hasError: true,
            error,
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        useToast().toast.error(`${error}`)
        useToast().toast.error(`${errorInfo}`)
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            // A class component has no hooks; the i18n singleton is the
            // escape hatch for code that cannot use `useTranslation`.
            return <h1>{String(i18n.t('ui.common.somethingWrong'))}</h1>
        }

        return this.props.children
    }
}
