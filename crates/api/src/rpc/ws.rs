use crate::{
    AppendixWithCell, BasicError, BlockId, BlockInfo, CellCoordinate, CellImageInfo, CellInfo,
    CellInput, CellPosition, CellRefRange, CfRuleInfo, ChartInfo, ColInfo, Comment, Context,
    DependentCell, DisplayWindow, DisplayWindowWithStartPoint, DiyCellId, Error, ErrorMessage,
    FillRange, LinkInfo, MergeCell, ReproducibleCell, SheetCoordinate, SheetId, Style, Value,
};

use logisheets_base::a1_notation;

use super::{Direction, Manager};

// ============================================================================
// Transport-agnostic worksheet logic. See the note in `controller.rs`: these
// receive a `&Manager` / `&mut Manager` from the transport and return typed
// values; serialization is done by the caller (`rpc::handle`).
// ============================================================================

pub fn get_sheet_dimension(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
) -> Result<crate::SheetDimension, ErrorMessage> {
    mgr.workbook(id)?
        .get_sheet_by_id(sheet_id)
        .map_err(ErrorMessage::from)?
        .get_sheet_dimension()
        .map_err(ErrorMessage::from)
}

pub fn get_dependents(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> Result<Vec<DependentCell>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_dependents(start_row, start_col, end_row, end_col)
        .context(|| {
            format!(
                "reading the dependents of {}:{} of {}",
                a1_notation(start_row, start_col),
                a1_notation(end_row, end_col),
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_precedents(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
) -> Result<Vec<CellRefRange>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_precedents(row, col)
        .context(|| format!("reading the precedents of {}", ws.describe_cell(row, col)))
        .map_err(ErrorMessage::from)
}

pub fn get_linkable_blocks(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    col_cnt: usize,
) -> Result<Vec<BlockInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_linkable_blocks(col_cnt))
}

pub fn get_links(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<Vec<LinkInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_links())
}

pub fn get_all_fully_covered_blocks(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    row_cnt: usize,
    col_cnt: usize,
) -> Result<Vec<BlockInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    Ok(ws.get_all_fully_covered_blocks(row, col, row + row_cnt - 1, col + col_cnt - 1))
}

pub fn get_row_height(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    row_idx: usize,
) -> Result<f64, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_row_height(row_idx)
        .context(|| {
            format!(
                "reading the height of row index {row_idx} of {}",
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_col_width(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    col_idx: usize,
) -> Result<f64, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_col_width(col_idx)
        .context(|| {
            format!(
                "reading the width of column index {col_idx} of {}",
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_cell_info(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
) -> Result<CellInfo, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_cell_info(row, col)
        .context(|| format!("reading {}", ws.describe_cell(row, col)))
        .map_err(ErrorMessage::from)
}

// The enum option set of a cell's list data-validation (inline lists only),
// or null. Serialized as `string[] | null`. Used by douyoushu to prefill enum
// inputs from a workbook's existing dropdowns.
pub fn get_cell_list_validation(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
) -> Result<Option<Vec<String>>, ErrorMessage> {
    Ok(mgr.workbook(id)?.get_cell_enum_options(sheet_idx, row, col))
}

pub fn get_col_info(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    col_idx: usize,
) -> Result<ColInfo, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws
        .get_col_info(col_idx)
        .unwrap_or(ColInfo::default(col_idx)))
}

pub fn get_value(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
) -> Result<Value, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_value(row_idx, col_idx)
        .context(|| {
            format!(
                "reading the value of {}",
                ws.describe_cell(row_idx, col_idx)
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_formula(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
) -> Result<String, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_formula(row_idx, col_idx)
        .context(|| {
            format!(
                "reading the formula of {}",
                ws.describe_cell(row_idx, col_idx)
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_style(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row_idx: usize,
    col_idx: usize,
) -> Result<Style, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_style(row_idx, col_idx)
        .context(|| {
            format!(
                "reading the style of {}",
                ws.describe_cell(row_idx, col_idx)
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_display_window(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    end_row: usize,
    start_col: usize,
    end_col: usize,
) -> Result<DisplayWindow, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_display_window(start_row, start_col, end_row, end_col)
        .context(|| {
            format!(
                "reading the display window {}:{} of {}",
                a1_notation(start_row, start_col),
                a1_notation(end_row, end_col),
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_display_window_with_start_point(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_x: f64,
    start_y: f64,
    height: f64,
    width: f64,
) -> Result<DisplayWindowWithStartPoint, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_display_window_response(start_x, start_y, width, height)
        .context(|| {
            format!(
                "reading the display window at ({start_x}, {start_y}) of {}",
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

pub fn get_display_window_within_cell(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    height: f64,
    width: f64,
) -> Result<DisplayWindowWithStartPoint, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    let CellPosition { x, y } = ws
        .get_cell_position(row, col)
        .context(|| format!("reading the position of {}", ws.describe_cell(row, col)))
        .map_err(ErrorMessage::from)?;
    let start_x = x - width / 2.5;
    let start_y = y - height / 2.5;
    get_display_window_with_start_point(mgr, id, sheet_idx, start_x, start_y, height, width)
}

pub fn get_merged_cells(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> Result<Vec<MergeCell>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_merged_cells(start_row, start_col, end_row, end_col))
}

pub fn get_comments(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<Vec<Comment>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_comments())
}

pub fn get_cell_images(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<Vec<CellImageInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_cell_images())
}

pub fn get_charts(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<Vec<ChartInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_charts())
}

pub fn get_conditional_formatting_rules(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
) -> Result<Vec<CfRuleInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    Ok(ws.get_conditional_formatting_rules())
}

pub fn get_cell_position(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
) -> Result<CellPosition, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_cell_position(row, col)
        .context(|| format!("reading the position of {}", ws.describe_cell(row, col)))
        .map_err(ErrorMessage::from)
}

pub fn get_diy_cell_id_with_block_id(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row: usize,
    col: usize,
) -> Result<Option<DiyCellId>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    Ok(ws.get_diy_cell_id_with_block_id(&block_id, row, col))
}

pub fn lookup_appendix_upward(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
    row_idx: usize,
    col_idx: usize,
    craft_id: String,
    tag: u8,
) -> Result<AppendixWithCell, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.lookup_appendix_upward(block_id, row_idx, col_idx, &craft_id, tag)
        .ok_or_else(|| {
            ErrorMessage::from(Error::Basic(BasicError::NoAppendix {
                block_id,
                craft_id,
                tag,
            }))
        })
}

pub fn get_cell_infos(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
) -> Result<Vec<CellInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_cell_infos(start_row, start_col, end_row, end_col)
        .context(|| {
            format!(
                "reading the cells {}:{} of {}",
                a1_notation(start_row, start_col),
                a1_notation(end_row, end_col),
                ws.describe()
            )
        })
        .map_err(ErrorMessage::from)
}

#[allow(clippy::too_many_arguments)]
pub fn predict_fill(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    src_start_row: usize,
    src_start_col: usize,
    src_end_row: usize,
    src_end_col: usize,
    dst_start_row: usize,
    dst_start_col: usize,
    dst_end_row: usize,
    dst_end_col: usize,
) -> Result<Vec<CellInput>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let src = FillRange {
        start_row: src_start_row,
        start_col: src_start_col,
        end_row: src_end_row,
        end_col: src_end_col,
    };
    let dst = FillRange {
        start_row: dst_start_row,
        start_col: dst_start_col,
        end_row: dst_end_row,
        end_col: dst_end_col,
    };
    wb.predict_fill(sheet_idx, src, dst)
        .map_err(ErrorMessage::from)
}

#[allow(clippy::too_many_arguments)]
pub fn get_cell_infos_except_window(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    start_row: usize,
    start_col: usize,
    end_row: usize,
    end_col: usize,
    window_start_row: usize,
    window_start_col: usize,
    window_end_row: usize,
    window_end_col: usize,
) -> Result<Vec<CellInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_cell_infos_except_window(
        start_row,
        start_col,
        end_row,
        end_col,
        window_start_row,
        window_start_col,
        window_end_row,
        window_end_col,
    )
    .map_err(ErrorMessage::from)
}

pub fn get_block_info(
    mgr: &Manager,
    id: usize,
    sheet_id: SheetId,
    block_id: BlockId,
) -> Result<BlockInfo, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_id(sheet_id).map_err(ErrorMessage::from)?;
    ws.get_block_info(block_id)
        .context(|| format!("reading block {block_id} of {}", ws.describe()))
        .map_err(ErrorMessage::from)
}

pub fn get_all_blocks(
    mgr: &Manager,
    id: usize,
    sheet_idx: Option<usize>,
    sheet_id: Option<SheetId>,
) -> Result<Vec<BlockInfo>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    wb.get_all_blocks(sheet_idx, sheet_id)
        .map_err(ErrorMessage::from)
}

pub fn save_checkpoint(
    mgr: &mut Manager,
    id: usize,
    label: String,
    description: Option<String>,
) -> Result<usize, ErrorMessage> {
    Ok(mgr.workbook_mut(id)?.save_checkpoint(label, description))
}

pub fn delete_checkpoint(
    mgr: &mut Manager,
    id: usize,
    label: String,
) -> Result<bool, ErrorMessage> {
    Ok(mgr.workbook_mut(id)?.delete_checkpoint(&label))
}

pub fn list_checkpoints(
    mgr: &Manager,
    id: usize,
) -> Result<Vec<super::CheckpointMetaDto>, ErrorMessage> {
    // Convert CheckpointMeta to the RPC DTO (drops the Status payload —
    // the manager's `list()` already only returns label + description).
    let wb = mgr.workbook(id)?;
    Ok(wb.list_checkpoints().into_iter().map(Into::into).collect())
}

pub fn get_reproducible_cell(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
) -> Result<ReproducibleCell, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_reproducible_cell(row, col)
        .context(|| format!("reading {} for reproduction", ws.describe_cell(row, col)))
        .map_err(ErrorMessage::from)
}

pub fn get_reproducible_cells(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    coordinates: Vec<SheetCoordinate>,
) -> Result<Vec<ReproducibleCell>, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    ws.get_reproducible_cells(coordinates)
        .context(|| format!("reading cells of {} for reproduction", ws.describe()))
        .map_err(ErrorMessage::from)
}

pub fn get_next_visible_cell(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    direction: Direction,
) -> Result<CellCoordinate, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    match direction {
        Direction::Up => ws.get_next_upward_visible_cell(row, col),
        Direction::Down => ws.get_next_downward_visible_cell(row, col),
        Direction::Left => ws.get_next_leftward_visible_cell(row, col),
        Direction::Right => ws.get_next_rightward_visible_cell(row, col),
    }
    .context(|| {
        format!(
            "looking for the next visible cell {direction:?} of {}",
            ws.describe_cell(row, col)
        )
    })
    .map_err(ErrorMessage::from)
}

pub fn get_data_boundary(
    mgr: &Manager,
    id: usize,
    sheet_idx: usize,
    row: usize,
    col: usize,
    direction: Direction,
) -> Result<CellCoordinate, ErrorMessage> {
    let wb = mgr.workbook(id)?;
    let ws = wb.get_sheet_by_idx(sheet_idx).map_err(ErrorMessage::from)?;
    match direction {
        Direction::Up => ws.get_upward_data_boundary(row, col),
        Direction::Down => ws.get_downward_data_boundary(row, col),
        Direction::Left => ws.get_leftward_data_boundary(row, col),
        Direction::Right => ws.get_rightward_data_boundary(row, col),
    }
    .context(|| {
        format!(
            "looking for the data boundary {direction:?} of {}",
            ws.describe_cell(row, col)
        )
    })
    .map_err(ErrorMessage::from)
}
