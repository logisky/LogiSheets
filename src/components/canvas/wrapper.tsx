import { CanvasProps, CanvasComponent } from './canvas'
import { Provider } from 'mobx-react'
import { xScrollbarStore, yScrollbarStore } from '../scrollbar'
import { canvasStore } from './store'
import { selectorStore } from '../selector'
import { dndStore } from '../dnd'
import { textareaStore } from '../textarea'
import { suggestStore } from '../suggest'
export default (props: CanvasProps) => {
    return <Provider xScrollbar={xScrollbarStore} yScrollbar={yScrollbarStore} selector={selectorStore} canvas={canvasStore} dnd={dndStore} textarea={textareaStore} suggest={suggestStore}>
        <CanvasComponent {...props}></CanvasComponent>
    </Provider>
}