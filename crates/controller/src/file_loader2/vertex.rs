use anyhow::Result;
use logisheets_base::{
    get_active_sheet::GetActiveSheetTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    CellId, ColId, Cube, ExtBookId, ExtRef, ExtRefId, FuncId, NameId, NormalRange, Range, RowId,
    SheetId, TextId,
};
use logisheets_parser::{ast, context::ContextTrait, Parser};

use crate::{connectors::VertexConnector, formula_manager::FormulaManager};

pub fn load_normal_formula<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    f: &str,
    connector: &'a mut VertexConnector<'a>,
) {
    let cid = connector.fetch_cell_id(&sheet_id, row, col).unwrap();
    if let CellId::NormalCell(c) = cid {
        let range = Range::Normal(NormalRange::Single(c));
        let range_id = formula_manager
            .range_manager
            .get_range_id(&sheet_id, &range);

        let ast_node = parse_formula(formula_manager, connector, f);

        formula_manager.add_ast_node(sheet_id, cid, range_id, ast_node)
    }
}

fn parse_formula<'a: 'c, 'b, 'c>(
    formula_manager: &'b mut FormulaManager,
    connector: &'c mut VertexConnector<'a>,
    f: &str,
) -> ast::Node {
    let parser = Parser {};
    let mut context = Context {
        formula_manager,
        vertex_connector: connector,
    };
    parser.parse(f, &mut context).unwrap()
}

pub fn load_shared_formulas<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    sheet_id: SheetId,
    master_row: usize,
    master_col: usize,
    row_start: usize,
    col_start: usize,
    row_end: usize,
    col_end: usize,
    master_formula: &str,
    connector: &'a mut VertexConnector<'a>,
) {
    let master_ast = parse_formula(formula_manager, connector, master_formula);
    for row in row_start..row_end + 1 {
        for col in col_start..col_end + 1 {
            let cid = connector.fetch_cell_id(&sheet_id, row, col).unwrap();
            let row_shift = row as i32 - master_row as i32;
            let col_shift = col as i32 - master_col as i32;
            let n = shift_ast_node(
                formula_manager,
                master_ast.clone(),
                sheet_id,
                row_shift,
                col_shift,
                connector,
            );
            if let CellId::NormalCell(c) = cid {
                let range = Range::Normal(NormalRange::Single(c));
                let range_id = formula_manager
                    .range_manager
                    .get_range_id(&sheet_id, &range);
                formula_manager.add_ast_node(sheet_id, cid, range_id, n)
            } else {
                unreachable!()
            }
        }
    }
}

fn shift_ast_node<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    master: ast::Node,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &'a mut VertexConnector,
) -> ast::Node {
    if row_shift == 0 && col_shift == 0 {
        return master;
    }
    let mut result = master;
    let pure = &mut result.pure;
    shift_pure_node(
        formula_manager,
        pure,
        sheet_id,
        row_shift,
        col_shift,
        connector,
    );
    result
}

fn shift_pure_node<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    pure: &'b mut ast::PureNode,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &'a mut VertexConnector,
) {
    match pure {
        ast::PureNode::Func(func) => {
            let args = &mut func.args;
            args.iter_mut().for_each(|node| {
                let p = &mut node.pure;
                shift_pure_node(
                    formula_manager,
                    p,
                    sheet_id,
                    row_shift,
                    col_shift,
                    connector,
                );
            });
        }
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(cell_ref) => {
            shift_cell_reference(
                formula_manager,
                cell_ref,
                sheet_id,
                row_shift,
                col_shift,
                connector,
            );
        }
    }
}

fn shift_cell_reference(
    formula_manager: &mut FormulaManager,
    cr: &mut ast::CellReference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &mut VertexConnector,
) -> Option<()> {
    if row_shift == 0 && col_shift == 0 {
        return None;
    }
    match cr {
        ast::CellReference::Mut(range_display) => {
            let range_id = range_display.range_id;
            let range = formula_manager
                .range_manager
                .get_range(&sheet_id, &range_id)?;
            match range {
                Range::Normal(n) => match n {
                    NormalRange::Single(c) => {
                        let (row_idx, col_idx) =
                            connector.fetch_normal_cell_index(&sheet_id, &c).unwrap();
                        let r = (row_idx as i32 + row_shift) as usize;
                        let c = (col_idx as i32 + col_shift) as usize;
                        let cell_id = connector.fetch_cell_id(&sheet_id, r, c).unwrap();
                        if let CellId::NormalCell(n) = cell_id {
                            let shift_range = Range::Normal(NormalRange::Single(n));
                            let range_id = formula_manager
                                .range_manager
                                .get_range_id(&sheet_id, &shift_range);
                            range_display.range_id = range_id;
                            Some(())
                        } else {
                            unreachable!()
                        }
                    }
                    _ => None,
                },
                Range::Block(_) => unreachable!(),
            }
        }
        _ => None,
    }
}

struct Context<'a, 'b, 'c> {
    formula_manager: &'b mut FormulaManager,
    vertex_connector: &'a mut VertexConnector<'c>,
}

impl<'a, 'b, 'c> IdFetcherTrait for Context<'a, 'b, 'c> {
    fn fetch_row_id(&mut self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId> {
        self.vertex_connector.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&mut self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId> {
        self.vertex_connector.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &mut self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<CellId> {
        self.vertex_connector
            .fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.vertex_connector.fetch_sheet_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> NameId {
        self.vertex_connector.fetch_name_id(workbook, name)
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        self.vertex_connector.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> TextId {
        self.vertex_connector.fetch_text_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId {
        self.vertex_connector.fetch_func_id(func_name)
    }
}

impl<'a, 'b, 'c> GetActiveSheetTrait for Context<'a, 'b, 'c> {
    fn get_active_sheet(&self) -> SheetId {
        self.vertex_connector.get_active_sheet()
    }
}

impl<'a, 'b, 'c> GetBookNameTrait for Context<'a, 'b, 'c> {
    fn get_book_name(&self) -> &str {
        self.vertex_connector.get_book_name()
    }
}

impl<'a, 'b, 'c> VertexFetcherTrait for Context<'a, 'b, 'c> {
    fn fetch_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> logisheets_base::RangeId {
        self.formula_manager
            .range_manager
            .get_range_id(sheet_id, range)
    }

    fn fetch_cube_id(&mut self, cube: &Cube) -> u32 {
        self.formula_manager.cube_manager.get_cube_id(cube)
    }

    fn fetch_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId {
        self.formula_manager.ext_ref_manager.get_ext_ref_id(ext_ref)
    }
}

impl<'a, 'b, 'c> ContextTrait for Context<'a, 'b, 'c> {}
