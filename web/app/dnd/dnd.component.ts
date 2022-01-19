import {Component, ChangeDetectionStrategy, Input} from '@angular/core'
const BORDER_WIDTH = 2
const POS = (position: number | null) => `${(position ?? 0) - BORDER_WIDTH}px`

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'logi-dnd',
    styleUrls: ['./dnd.component.scss'],
    templateUrl: './dnd.component.html',
})
export class DndComponent {
    @Input() x: number | null = -1
    @Input() y: number | null = -1
    @Input() width: number | null = -1
    @Input() height: number | null = -1
    @Input() draggingX: number | null = -1
    @Input() draggingY: number | null = -1
    get borderStyle() {
        return {
            left: POS(this.x),
            top: POS(this.y),
            width: `${this.width}px`,
            height: `${this.height}px`,
        }
    }

    get draggingStyle() {
        const invalid = () => {
            if (this.draggingX === this.x && this.draggingY === this.y)
                return true
            if (this.draggingX === null || this.draggingY === null)
                return true
            if (this.draggingX < 0 || this.draggingY < 0)
                return true
            return false
        }
        return {
            display: invalid() ? 'none' : 'block',
            left: POS(this.draggingX),
            top: POS(this.draggingY),
            width: `${this.width}px`,
            height: `${this.height}px`,
        }
    }
}
