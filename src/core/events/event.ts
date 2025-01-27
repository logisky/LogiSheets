export const enum EventType {
    // Mouse
    CLICK = 'click',
    AUXCLICK = 'auxclick',
    DBLCLICK = 'dblclick',
    MOUSE_UP = 'mouseup',
    MOUSE_DOWN = 'mousedown',
    MOUSE_OVER = 'mouseover',
    MOUSE_MOVE = 'mousemove',
    MOUSE_OUT = 'mouseout',
    MOUSE_ENTER = 'mouseenter',
    MOUSE_LEAVE = 'mouseleave',
    MOUSE_WHEEL = 'wheel',
    POINTER_UP = 'pointerup',
    POINTER_DOWN = 'pointerdown',
    POINTER_MOVE = 'pointermove',
    CONTEXT_MENU = 'contextmenu',
    // Keyboard
    KEY_DOWN = 'keydown',
    KEY_PRESS = 'keypress',
    KEY_UP = 'keyup',
    // HTML Document
    LOAD = 'load',
    BEFORE_UNLOAD = 'beforeunload',
    UNLOAD = 'unload',
    ABORT = 'abort',
    ERROR = 'error',
    RESIZE = 'resize',
    SCROLL = 'scroll',
    FULLSCREEN_CHANGE = 'fullscreenchange',
    WK_FULLSCREEN_CHANGE = 'webkitfullscreenchange',
    // Form
    SELECT = 'select',
    CHANGE = 'change',
    SUBMIT = 'submit',
    RESET = 'reset',
    FOCUS = 'focus',
    FOCUS_IN = 'focusin',
    FOCUS_OUT = 'focusout',
    BLUR = 'blur',
    INPUT = 'input',
    // Local Storage
    STORAGE = 'storage',
    // Drag
    DRAG_START = 'dragstart',
    DRAG = 'drag',
    DRAG_ENTER = 'dragenter',
    DRAG_LEAVE = 'dragleave',
    DRAG_OVER = 'dragover',
    DROP = 'drop',
    DRAG_END = 'dragend',
    // // Animation
    // ANIMATION_START: browser.isWebKit ? 'webkitAnimationStart' : 'animationstart',
    // ANIMATION_END: browser.isWebKit ? 'webkitAnimationEnd' : 'animationend',
    // ANIMATION_ITERATION: browser.isWebKit ? 'webkitAnimationIteration' : 'animationiteration'
    COMPOSITION_START = 'compositionstart',
    COMPOSITION_END = 'compositionend',
    COMPOSITION_UPDATE = 'compositionupdate',
    COPY = 'copy',
    PASTE = 'paste',
    CUT = 'cut',
    SELECTION_CHANGE = 'selectionchange',
}
