import React from 'react'
export interface IErrorBoundaryState {
    hasError: boolean
    error: any
    errorInfo: any
}

export interface IErrorBoundaryProps {
  children: React.ReactElement
}
export class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
    constructor(props: IErrorBoundaryProps) {
      super(props);
      this.state = {
        hasError: false,
        error: null,
        errorInfo: null,
    };
    }
  
    static getDerivedStateFromError(error: any) {
        // Update state so the next render will show the fallback UI.
        return {
            hasError: true,
            error,
        };
    }
  
    componentDidCatch(error: any, errorInfo: any) {
      // You can also log the error to an error reporting service
      console.log('error: ', error)
      console.log('errorInfo: ', errorInfo)
    }
  
    render() {
      if (this.state.hasError) {
        // You can render any custom fallback UI
        return <h1>Something went wrong.</h1>;
      }
  
      return this.props.children 
    }
  }