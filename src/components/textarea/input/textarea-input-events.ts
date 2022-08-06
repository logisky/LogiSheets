import {
    CompositionStartEvent,
    CompositionData,
    ClipboardStoredMetaData,
    StandardKeyboardEvent,
} from '@/core/events'
import { Subject } from 'rxjs'
import { TypeData } from './type_data'
import { Selection } from './selection'

export class TextAreaInputEvents {
    onKeyDown$ = new Subject<StandardKeyboardEvent>()
    onKeyUp$ = new Subject<KeyboardEvent>()
    onCompositionStart$ = new Subject<CompositionStartEvent>()
    onCompositionUpdate$ = new Subject<CompositionData>()
    onCompositionEnd$ = new Subject<undefined>()
    onFocus$ = new Subject<undefined>()
    onBlur$ = new Subject<undefined>()
    onCut$ = new Subject<undefined>()
    onPaste$ = new Subject<ClipboardStoredMetaData>()
    onType$ = new Subject<TypeData>()
    onSelectionChange$ = new Subject<Selection>()
}
