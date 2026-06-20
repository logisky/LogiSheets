import {FC} from 'react'

// The engine's top-left header corner (select-all cell). Always visible, never
// scrolled away or clipped between panes — a stable home for the active-view
// indicator.
const LeftTop = {width: 32, height: 24}

/**
 * Active-view indicator. Sits in the top-left header corner of a view: a solid
 * blue dot when the view is active, a faint hollow dot otherwise. Both views
 * always show one, so the highlighted (blue) one reads as "this is where your
 * input lands".
 */
export const ActiveViewBadge: FC<{active: boolean}> = ({active}) => (
    <div
        title={active ? 'Active view' : 'Inactive view'}
        style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: LeftTop.width,
            height: LeftTop.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 6,
        }}
    >
        <span
            style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                boxSizing: 'border-box',
                background: active ? '#1976d2' : 'transparent',
                border: active ? 'none' : '1.5px solid #bbb',
                boxShadow: active ? '0 0 0 3px rgba(25,118,210,0.25)' : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
            }}
        />
    </div>
)
