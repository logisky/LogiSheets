/**
 * The block chrome's colours — the outline, the header bars, the two round
 * buttons, the drag ghost.
 *
 * Why they live in one place: a block is the only thing on the sheet that is
 * permanently outlined, so whatever colour it wears, the user sees it all day
 * on every block at once. It used to be MUI deep purple (#673AB7) at 2px, hard
 * -coded in eight places, and it read as decoration sitting on top of the
 * spreadsheet rather than as part of it.
 *
 * The scheme now is **quiet at rest, present on interaction**:
 *
 * - at rest a 1px hairline, barely more than a table rule — enough to say
 *   "these cells belong together", not enough to compete with the data;
 * - on hover (or on a block paired with the hovered one) 2px solid, which is
 *   what makes the outline something you can aim at and grab;
 * - the header bars and buttons are flat fills of the same family, no
 *   gradients: a gradient on a 24px bar only reads as noise.
 *
 * The hue is a warm slate. It is deliberately NOT a saturated accent: the grid
 * already spends blue (#1a73e8) on selection and red on validation, and a
 * third loud colour permanently on screen is what made the old one jarring.
 * Slate stays legible against every cell fill a user is likely to pick.
 */

/** Hairline around a block nobody is pointing at. */
export const BLOCK_BORDER_REST = 'rgba(71, 85, 105, 0.30)'

/** The outline of the block under the pointer (and of its pair). */
export const BLOCK_BORDER_ACTIVE = 'rgb(71, 85, 105)'

/** Title bar — the darkest surface, so it reads as the block's name plate. */
export const BLOCK_TITLE_BG = 'rgb(51, 65, 85)'

/** Field-name headers, one step lighter than the title above them. */
export const BLOCK_FIELD_BG = 'rgb(71, 85, 105)'

/** Hover state for a field header (they are clickable: sort / reorder). */
export const BLOCK_FIELD_BG_HOVER = 'rgb(51, 65, 85)'

/** Text on any of the filled surfaces above. */
export const BLOCK_ON_SURFACE = '#fff'

/** Round buttons (settings, add row) that hang off the outline on hover. */
export const BLOCK_BUTTON = 'rgb(71, 85, 105)'
export const BLOCK_BUTTON_HOVER = 'rgb(30, 41, 59)'

/** Wash inside the drop ghost while a block is being dragged. */
export const BLOCK_GHOST_FILL = 'rgba(71, 85, 105, 0.08)'

/** A drop that would overlap something — the one place that stays red. */
export const BLOCK_INVALID = 'rgb(211, 47, 47)'
export const BLOCK_INVALID_FILL = 'rgba(211, 47, 47, 0.10)'
