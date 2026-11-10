//! Where a cell's hyperlink goes.
//!
//! A cell links somewhere in one of two ways: a stored link (`SetHyperlink`,
//! or a `<hyperlink>` read from the file), or a formula whose outermost call
//! is `HYPERLINK(...)`. The second has no stored target — its
//! `link_location` is an expression — so the target is evaluated here, when
//! the host asks, the same way `check_field_validation` evaluates a rule:
//! run the calculator over that one node and register nothing.
//!
//! Rendering only needs to know THAT a cell is a link (`CellInfo::is_hyperlink`),
//! which is cheap; the target is asked for on click.

use std::collections::{HashMap, HashSet};

use gents_derives::TS;
use logisheets_base::{Addr, CellId, SheetId, errors::BasicError};
use logisheets_parser::ast;

// NB: no `use crate::errors::Result` — the alias would shadow
// `std::result::Result` inside the serde impls the `TS` derive generates.
use crate::{
    calc_engine::calculator::{
        calc_vertex::{CalcValue, Value},
        calculator::calc,
        number_text::number_to_text,
    },
    connectors::CalcConnector,
    controller::Controller,
    errors::Error,
};

use super::Workbook;

/// A cell's link target, resolved. At least one of `url` and `location` is
/// set.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "hyperlink_info.ts", rename_all = "camelCase")]
pub struct HyperlinkInfo {
    /// An external target — a web address, `mailto:`, a file path — to hand
    /// to the browser or OS as-is.
    pub url: Option<String>,
    /// A place in this workbook, e.g. `Sheet2!A1` or a defined name, without
    /// the leading `#` a `HYPERLINK` formula spells it with.
    pub location: Option<String>,
    pub tooltip: Option<String>,
    /// The target came from a `HYPERLINK` formula rather than a stored link.
    /// Editing or removing it means editing the formula.
    pub from_formula: bool,
}

/// The `link_location` argument of the cell's formula, when the formula is a
/// `HYPERLINK(...)` call at the top level.
pub(crate) fn hyperlink_formula_target<'a>(
    controller: &'a Controller,
    sheet_id: SheetId,
    cell_id: &CellId,
) -> Option<&'a ast::Node> {
    let node = controller
        .status
        .formula_manager
        .formulas
        .get(&(sheet_id, *cell_id))?;
    let ast::PureNode::Func(func) = &node.pure else {
        return None;
    };
    let ast::Operator::Function(fid) = &func.op else {
        return None;
    };
    let hyperlink = controller.status.func_id_manager.get_id("HYPERLINK")?;
    if fid != hyperlink {
        return None;
    }
    func.args.first()
}

/// Whether the cell renders as a link: it has a stored link or a top-level
/// `HYPERLINK` formula.
pub(crate) fn is_hyperlink(controller: &Controller, sheet_id: SheetId, cell_id: &CellId) -> bool {
    controller
        .status
        .cell_attachment_manager
        .hyperlinks
        .get(&sheet_id, cell_id)
        .is_some()
        || hyperlink_formula_target(controller, sheet_id, cell_id).is_some()
}

impl Workbook {
    /// Where the link at `(row, col)` goes, or `None` when the cell is not a
    /// link — or is a `HYPERLINK` formula whose `link_location` evaluates to an
    /// error, a range, or nothing. A stored link wins over a formula.
    ///
    /// Read-only: a formula's target is evaluated without being registered,
    /// so the workbook is unchanged when this returns.
    pub fn get_hyperlink(
        &mut self,
        sheet_idx: usize,
        row: usize,
        col: usize,
    ) -> std::result::Result<Option<HyperlinkInfo>, Error> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let Ok(cell_id) = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&sheet_id, row, col)
        else {
            return Ok(None);
        };
        if let Some(link) = self
            .controller
            .status
            .cell_attachment_manager
            .hyperlinks
            .get(&sheet_id, &cell_id)
        {
            return Ok(Some(HyperlinkInfo {
                url: link.url.clone(),
                location: link.location.clone(),
                tooltip: link.tooltip.clone(),
                from_formula: false,
            }));
        }
        let Some(node) = hyperlink_formula_target(&self.controller, sheet_id, &cell_id).cloned()
        else {
            return Ok(None);
        };
        let Some(target) = self.eval_link_location(sheet_id, row, col, &node) else {
            return Ok(None);
        };
        let target = target.trim();
        if target.is_empty() {
            return Ok(None);
        }
        // `#Sheet2!A1` is a place in this workbook; anything else is handed
        // to the browser or OS, as Excel does.
        let info = match target.strip_prefix('#') {
            Some(location) => HyperlinkInfo {
                location: Some(location.to_string()),
                from_formula: true,
                ..Default::default()
            },
            None => HyperlinkInfo {
                url: Some(target.to_string()),
                from_formula: true,
                ..Default::default()
            },
        };
        Ok(Some(info))
    }

    /// `node` evaluated as text, from the cell at `(row, col)`.
    fn eval_link_location(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        node: &ast::Node,
    ) -> Option<String> {
        let status = &mut self.controller.status;
        let mut dirty_next: imbl::HashSet<(SheetId, CellId)> = imbl::HashSet::new();
        let mut calc_cells: HashSet<(SheetId, CellId)> = HashSet::new();
        let mut async_func_manager = crate::async_func_manager::AsyncFuncManager::default();
        let async_funcs: HashSet<String> = HashSet::new();
        let mut connector = CalcConnector {
            range_manager: &status.range_manager,
            cube_manager: &status.cube_manager,
            navigator: &mut status.navigator,
            container: &mut status.container,
            ext_links: &mut status.external_links_manager,
            text_id_manager: &mut status.text_id_manager,
            func_id_manager: &status.func_id_manager,
            sheet_id_manager: &status.sheet_id_manager,
            names_storage: HashMap::new(),
            cells_storage: HashMap::new(),
            sheet_pos_manager: &status.sheet_info_manager,
            async_func_manager: &mut async_func_manager,
            async_funcs: &async_funcs,
            active_sheet: sheet_id,
            curr_addr: Addr { row, col },
            dirty_cells_in_next_run: &mut dirty_next,
            calc_cells: &mut calc_cells,
            block_schema_manager: &status.block_schema_manager,
            formula_manager: &status.formula_manager,
            name_id_manager: &status.name_id_manager,
            ext_ref_manager: &status.ext_ref_manager,
        };
        match calc(node, &mut connector) {
            CalcValue::Scalar(Value::Text(t)) => Some(t),
            CalcValue::Scalar(Value::Number(n)) => Some(number_to_text(n)),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Value;
    use crate::api::Workbook;
    use crate::edit_action::{
        CellInput, EditAction, EditPayload, InsertRows, PayloadsAction, RemoveHyperlink,
        SetHyperlink, StatusCode,
    };

    fn apply(wb: &mut Workbook, payloads: Vec<EditPayload>) -> StatusCode {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: true,
            init: false,
        }))
        .status
    }

    fn input(row: usize, col: usize, content: &str) -> EditPayload {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    }

    fn link(row: usize, col: usize, url: Option<&str>, location: Option<&str>) -> EditPayload {
        EditPayload::SetHyperlink(SetHyperlink {
            sheet_idx: 0,
            row,
            col,
            url: url.map(str::to_string),
            location: location.map(str::to_string),
            tooltip: Some("tip".to_string()),
        })
    }

    fn is_link(wb: &Workbook, row: usize, col: usize) -> bool {
        wb.get_sheet_by_idx(0)
            .unwrap()
            .get_cell_info(row, col)
            .unwrap()
            .is_hyperlink
    }

    #[test]
    fn stored_link_follows_its_cell_and_undoes() {
        let mut wb = Workbook::default();
        apply(&mut wb, vec![input(1, 1, "site")]);
        apply(&mut wb, vec![link(1, 1, Some("https://example.com"), None)]);
        assert!(is_link(&wb, 1, 1));
        let info = wb.get_hyperlink(0, 1, 1).unwrap().unwrap();
        assert_eq!(info.url.as_deref(), Some("https://example.com"));
        assert_eq!(info.tooltip.as_deref(), Some("tip"));
        assert!(!info.from_formula);

        // A row inserted above carries the link down with its cell.
        apply(
            &mut wb,
            vec![EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 0,
                count: 2,
            })],
        );
        assert!(!is_link(&wb, 1, 1));
        assert!(wb.get_hyperlink(0, 3, 1).unwrap().is_some());

        assert!(wb.undo());
        assert!(wb.get_hyperlink(0, 1, 1).unwrap().is_some());

        apply(
            &mut wb,
            vec![EditPayload::RemoveHyperlink(RemoveHyperlink {
                sheet_idx: 0,
                row: 1,
                col: 1,
            })],
        );
        assert!(!is_link(&wb, 1, 1));
        assert!(wb.get_hyperlink(0, 1, 1).unwrap().is_none());
        assert!(wb.undo());
        assert!(is_link(&wb, 1, 1));
    }

    #[test]
    fn a_link_needs_a_target() {
        let mut wb = Workbook::default();
        let status = apply(&mut wb, vec![link(0, 0, None, None)]);
        assert!(matches!(status, StatusCode::Err(_)));
        assert!(!is_link(&wb, 0, 0));
    }

    #[test]
    fn hyperlink_formula_shows_its_name_and_resolves_on_demand() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "42"),
                input(
                    1,
                    0,
                    "=HYPERLINK(\"https://example.com/item/\"&A1, \"Item\")",
                ),
                input(2, 0, "=HYPERLINK(\"#Sheet1!C5\")"),
                input(3, 0, "=HYPERLINK(1/0, \"Broken\")"),
                input(4, 0, "=1+HYPERLINK(\"x\", 2)"),
            ],
        );
        let ws = wb.get_sheet_by_idx(0).unwrap();
        assert!(matches!(ws.get_value(1, 0).unwrap(), Value::Str(s) if s == "Item"));
        assert!(matches!(ws.get_value(2, 0).unwrap(), Value::Str(s) if s == "#Sheet1!C5"));
        assert!(matches!(ws.get_value(3, 0).unwrap(), Value::Error(e) if e == "#DIV/0!"));
        assert!(matches!(ws.get_value(4, 0).unwrap(), Value::Number(n) if n == 3.0));
        drop(ws);

        let item = wb.get_hyperlink(0, 1, 0).unwrap().unwrap();
        assert_eq!(item.url.as_deref(), Some("https://example.com/item/42"));
        assert!(item.from_formula);
        let place = wb.get_hyperlink(0, 2, 0).unwrap().unwrap();
        assert_eq!(place.location.as_deref(), Some("Sheet1!C5"));
        assert!(place.url.is_none());
        // An error target is no target; only a top-level call is a link.
        assert!(wb.get_hyperlink(0, 3, 0).unwrap().is_none());
        assert!(is_link(&wb, 3, 0));
        assert!(!is_link(&wb, 4, 0));
        assert!(wb.get_hyperlink(0, 4, 0).unwrap().is_none());
        // Asking evaluated nothing into the workbook.
        assert!(matches!(
            wb.get_sheet_by_idx(0).unwrap().get_value(1, 0).unwrap(),
            Value::Str(s) if s == "Item"
        ));
    }

    #[test]
    fn links_survive_save_and_reload() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "web"),
                input(1, 0, "place"),
                link(0, 0, Some("https://example.com/?a=1&b=2"), None),
                link(1, 0, None, Some("Sheet1!D4")),
            ],
        );
        let bytes = wb.save().unwrap();
        let mut back = Workbook::from_file(&bytes, "reloaded".to_string()).unwrap();
        let web = back.get_hyperlink(0, 0, 0).unwrap().unwrap();
        assert_eq!(web.url.as_deref(), Some("https://example.com/?a=1&b=2"));
        assert_eq!(web.tooltip.as_deref(), Some("tip"));
        let place = back.get_hyperlink(0, 1, 0).unwrap().unwrap();
        assert_eq!(place.location.as_deref(), Some("Sheet1!D4"));
        assert!(place.url.is_none());

        // And again: a second save must not lose or duplicate them.
        let again = back.save().unwrap();
        let mut third = Workbook::from_file(&again, "again".to_string()).unwrap();
        assert!(third.get_hyperlink(0, 0, 0).unwrap().is_some());
        assert!(third.get_hyperlink(0, 1, 0).unwrap().is_some());
    }
}
