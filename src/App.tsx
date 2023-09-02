import './App.scss'
import {SpreadsheetRoot} from './components/root/index'
import {useEventListener} from 'ahooks'

function App() {
    useEventListener('keydown', e => {
        console.log('global keydown event listen')
        console.log(e.target)
    })
    return (
        <div className="App">
            <SpreadsheetRoot></SpreadsheetRoot>
        </div>
    )
}

export default App
