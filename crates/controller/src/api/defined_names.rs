//! Read the workbook's defined names.

use gents_derives::TS;
use logisheets_base::SheetId;
use logisheets_parser::unparse;

use super::Workbook;
use crate::connectors::NameFetcher;

/// A workbook-scoped defined name and what it refers to.
#[derive(Debug, Clone, TS)]
#[ts(file_name = "defined_name_info.ts", rename_all = "camelCase")]
pub struct DefinedNameInfo {
    pub name: String,
    /// The definition without a leading `=`, every reference sheet-qualified
    /// (`Sheet1!$B$2:$B$9`) so it reads the same from any sheet.
    pub formula: String,
}

impl Workbook {
    /// Every defined name, ordered case-insensitively by name.
    pub fn get_defined_names(&self) -> Vec<DefinedNameInfo> {
        let status = &self.controller.status;
        let mut fetcher = NameFetcher {
            func_manager: &status.func_id_manager,
            sheet_id_manager: &status.sheet_id_manager,
            external_links_manager: &status.external_links_manager,
            text_id_manager: &status.text_id_manager,
            name_id_manager: &status.name_id_manager,
            navigator: &status.navigator,
            range_manager: &status.range_manager,
            cube_manager: &status.cube_manager,
            ext_ref_manager: &status.ext_ref_manager,
            block_schema_manager: &status.block_schema_manager,
        };
        let mut out = status
            .formula_manager
            .names
            .iter()
            .filter_map(|(id, ast)| {
                let (_, name) = status.name_id_manager.get_string(id)?;
                // No sheet is `SheetId::MAX`, so every reference gets a prefix.
                let formula = unparse::unparse(ast, &mut fetcher, SheetId::MAX)
                    .unwrap_or_else(|_| String::from("#REF!"));
                Some(DefinedNameInfo { name, formula })
            })
            .collect::<Vec<_>>();
        out.sort_by_key(|n| n.name.to_uppercase());
        out
    }
}

#[cfg(test)]
mod tests {
    use crate::api::Workbook;
    use crate::controller::display::Value;
    use crate::edit_action::{
        CellInput, DefineName, EditAction, EditPayload, InsertRows, PayloadsAction, RemoveName,
        RenameName, StatusCode,
    };

    fn apply(wb: &mut Workbook, payloads: Vec<EditPayload>) -> bool {
        let effect = wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: true,
            init: false,
        }));
        matches!(effect.status, StatusCode::Ok(_))
    }

    fn input(row: usize, col: usize, content: &str) -> EditPayload {
        EditPayload::CellInput(CellInput {
            sheet_idx: 0,
            row,
            col,
            content: content.to_string(),
        })
    }

    fn define(name: &str, formula: &str) -> EditPayload {
        EditPayload::DefineName(DefineName {
            name: name.to_string(),
            formula: formula.to_string(),
            sheet_idx: 0,
        })
    }

    fn value(wb: &Workbook, row: usize, col: usize) -> Value {
        wb.get_sheet_by_idx(0).unwrap().get_value(row, col).unwrap()
    }

    fn formula(wb: &Workbook, row: usize, col: usize) -> String {
        wb.get_sheet_by_idx(0)
            .unwrap()
            .get_formula(row, col)
            .unwrap()
    }

    #[test]
    fn a_name_evaluates_as_a_range_and_as_a_constant() {
        let mut wb = Workbook::default();
        assert!(apply(
            &mut wb,
            vec![
                input(0, 0, "1"),
                input(1, 0, "2"),
                input(2, 0, "3"),
                define("Sales", "=A1:A3"),
                define("Tax", "0.5"),
                input(0, 2, "=SUM(Sales)*Tax"),
                input(1, 2, "=ROWS(sales)"),
            ]
        ));
        assert!(matches!(value(&wb, 0, 2), Value::Number(n) if n == 3.0));
        assert!(matches!(value(&wb, 1, 2), Value::Number(n) if n == 3.0));
        // Case-insensitive, shown in the defined spelling.
        assert_eq!(formula(&wb, 1, 2), "ROWS(Sales)");
        let names = wb.get_defined_names();
        assert_eq!(names.len(), 2);
        assert_eq!(names[0].name, "Sales");
        assert_eq!(names[0].formula, "Sheet1!A1:A3");
        assert_eq!(names[1].formula, "0.5");
    }

    #[test]
    fn a_change_under_a_name_reaches_its_users() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "1"),
                define("X", "Sheet1!$A$1"),
                input(0, 1, "=X*10"),
            ],
        );
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 10.0));
        apply(&mut wb, vec![input(0, 0, "4")]);
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 40.0));
        // Redefining recalculates too.
        apply(&mut wb, vec![input(1, 0, "7"), define("X", "Sheet1!$A$2")]);
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 70.0));
    }

    #[test]
    fn an_undefined_name_is_name_error_until_defined() {
        let mut wb = Workbook::default();
        apply(&mut wb, vec![input(0, 0, "=Later+1")]);
        assert!(matches!(value(&wb, 0, 0), Value::Error(e) if e == "#NAME?"));
        apply(&mut wb, vec![define("later", "41")]);
        assert!(matches!(value(&wb, 0, 0), Value::Number(n) if n == 42.0));
        apply(
            &mut wb,
            vec![EditPayload::RemoveName(RemoveName {
                name: "LATER".into(),
            })],
        );
        assert!(matches!(value(&wb, 0, 0), Value::Error(e) if e == "#NAME?"));
        assert!(wb.get_defined_names().is_empty());
        wb.undo();
        assert!(matches!(value(&wb, 0, 0), Value::Number(n) if n == 42.0));
        assert_eq!(wb.get_defined_names().len(), 1);
    }

    #[test]
    fn a_rename_is_followed_by_the_formulas_using_it() {
        let mut wb = Workbook::default();
        apply(&mut wb, vec![define("Old", "2"), input(0, 0, "=Old*3")]);
        assert!(apply(
            &mut wb,
            vec![EditPayload::RenameName(RenameName {
                old_name: "old".into(),
                new_name: "Rate".into(),
            })]
        ));
        assert_eq!(formula(&wb, 0, 0), "Rate * 3");
        assert!(matches!(value(&wb, 0, 0), Value::Number(n) if n == 6.0));
        apply(&mut wb, vec![define("Other", "1")]);
        assert!(!apply(
            &mut wb,
            vec![EditPayload::RenameName(RenameName {
                old_name: "Rate".into(),
                new_name: "OTHER".into(),
            })]
        ));
    }

    #[test]
    fn a_rename_then_redefine_keeps_the_formulas_following() {
        // The name manager's edit: `renameName`, then `defineName` under the
        // new name. The formula was typed in a different case.
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![define("Sales", "$A$1:$A$3"), input(0, 2, "=SUM(sales)*2")],
        );
        assert!(apply(
            &mut wb,
            vec![EditPayload::RenameName(RenameName {
                old_name: "Sales".into(),
                new_name: "Revenue".into(),
            })]
        ));
        assert!(apply(&mut wb, vec![define("Revenue", "Sheet1!$A$1:$A$3")]));
        assert_eq!(formula(&wb, 0, 2), "SUM(Revenue) * 2");
        let cell = wb.get_sheet_by_idx(0).unwrap().get_cell_info(0, 2).unwrap();
        assert_eq!(cell.formula, "SUM(Revenue) * 2");
    }

    #[test]
    fn a_named_range_moves_with_inserted_rows() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "1"),
                input(1, 0, "2"),
                define("Rng", "$A$1:$A$2"),
                input(0, 1, "=SUM(Rng)"),
            ],
        );
        apply(
            &mut wb,
            vec![EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start: 0,
                count: 1,
            })],
        );
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$A$2:$A$3");
        assert!(matches!(value(&wb, 1, 1), Value::Number(n) if n == 3.0));
    }

    /// A1:A3 = 1, 2, 3 named `Rng`; B1 = SUM(Rng).
    fn three_rows_named() -> Workbook {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "1"),
                input(1, 0, "2"),
                input(2, 0, "3"),
                define("Rng", "$A$1:$A$3"),
                input(0, 1, "=SUM(Rng)"),
            ],
        );
        wb
    }

    fn rows(op: &str, start: usize, count: usize) -> EditPayload {
        match op {
            "insert" => EditPayload::InsertRows(InsertRows {
                sheet_idx: 0,
                start,
                count,
            }),
            _ => EditPayload::DeleteRows(crate::edit_action::DeleteRows {
                sheet_idx: 0,
                start,
                count,
            }),
        }
    }

    fn cols(op: &str, start: usize, count: usize) -> EditPayload {
        match op {
            "insert" => EditPayload::InsertCols(crate::edit_action::InsertCols {
                sheet_idx: 0,
                start,
                count,
            }),
            _ => EditPayload::DeleteCols(crate::edit_action::DeleteCols {
                sheet_idx: 0,
                start,
                count,
            }),
        }
    }

    #[test]
    fn inserting_rows_inside_a_named_range_grows_it() {
        let mut wb = three_rows_named();
        apply(&mut wb, vec![rows("insert", 1, 2)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$A$1:$A$5");
        apply(&mut wb, vec![input(1, 0, "10")]);
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 16.0));
    }

    #[test]
    fn deleting_rows_inside_a_named_range_shrinks_it() {
        let mut wb = three_rows_named();
        apply(&mut wb, vec![rows("delete", 1, 1)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$A$1:$A$2");
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 4.0));
    }

    #[test]
    fn deleting_rows_below_a_named_range_leaves_it_alone() {
        let mut wb = three_rows_named();
        apply(&mut wb, vec![rows("delete", 5, 2)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$A$1:$A$3");
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 6.0));
    }

    #[test]
    fn deleting_every_row_of_a_named_range_is_ref_error() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(1, 0, "5"),
                input(2, 0, "7"),
                define("Gone", "$A$2:$A$3"),
                input(0, 1, "=SUM(Gone)"),
            ],
        );
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 12.0));
        apply(&mut wb, vec![rows("delete", 1, 2)]);
        assert!(matches!(value(&wb, 0, 1), Value::Error(e) if e == "#REF!"));
        // Undo brings the range and the value back.
        wb.undo();
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$A$2:$A$3");
        assert!(matches!(value(&wb, 0, 1), Value::Number(n) if n == 12.0));
    }

    #[test]
    fn a_single_cell_name_follows_its_cell_and_dies_with_it() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(2, 2, "9"),
                define("One", "$C$3"),
                input(0, 0, "=One*2"),
            ],
        );
        apply(&mut wb, vec![rows("insert", 0, 1), cols("insert", 0, 1)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$D$4");
        assert!(matches!(value(&wb, 1, 1), Value::Number(n) if n == 18.0));
        apply(&mut wb, vec![rows("delete", 3, 1)]);
        assert!(matches!(value(&wb, 1, 1), Value::Error(e) if e == "#REF!"));
    }

    #[test]
    fn column_insert_and_delete_move_a_named_range() {
        let mut wb = three_rows_named();
        apply(&mut wb, vec![cols("insert", 0, 2)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$C$1:$C$3");
        assert!(matches!(value(&wb, 0, 3), Value::Number(n) if n == 6.0));
        apply(&mut wb, vec![cols("delete", 0, 1)]);
        assert_eq!(wb.get_defined_names()[0].formula, "Sheet1!$B$1:$B$3");
        assert!(matches!(value(&wb, 0, 2), Value::Number(n) if n == 6.0));
    }

    #[test]
    fn bad_names_and_self_reference_are_refused() {
        let mut wb = Workbook::default();
        assert!(!apply(&mut wb, vec![define("A1", "1")]));
        assert!(!apply(&mut wb, vec![define("ok", "=SUM(")]));
        assert!(!apply(&mut wb, vec![define("Loop", "Loop+1")]));
        apply(&mut wb, vec![define("P", "1")]);
        apply(&mut wb, vec![define("Q", "P+1")]);
        assert!(!apply(&mut wb, vec![define("P", "Q+1")]));
        assert_eq!(wb.get_defined_names().len(), 2);
    }

    #[test]
    fn names_survive_save_and_reload() {
        let mut wb = Workbook::default();
        apply(
            &mut wb,
            vec![
                input(0, 0, "5"),
                define("Base", "Sheet1!$A$1"),
                input(0, 1, "=Base*2"),
            ],
        );
        let bytes = wb.save().unwrap();
        let mut back = Workbook::from_file(&bytes, "t".to_string()).unwrap();
        let names = back.get_defined_names();
        assert_eq!(names.len(), 1);
        assert_eq!(names[0].name, "Base");
        assert_eq!(names[0].formula, "Sheet1!$A$1");
        apply(&mut back, vec![input(0, 0, "6")]);
        assert!(matches!(value(&back, 0, 1), Value::Number(n) if n == 12.0));
    }
}
