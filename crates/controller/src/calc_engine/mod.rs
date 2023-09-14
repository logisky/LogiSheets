mod calc_order;
pub mod calculator;
pub mod connector;
mod cycle;

use logisheets_base::{Addr, BlockRange, NormalRange, Range};

use crate::formula_manager::{FormulaManager, Vertex};
use crate::settings::CalcConfig;
use crate::{CellId, SheetId};
use calc_order::{calc_order, CalcUnit};

use self::connector::Connector;
use calculator::calculator::calc;
use cycle::CycleCalculator;

pub struct CalcEngine<'a, C>
where
    C: Connector,
{
    pub formula_manager: &'a FormulaManager,
    pub dirty_vertices: std::collections::HashSet<Vertex>,
    pub config: CalcConfig,
    pub connector: C,
}

impl<'a, C> CalcEngine<'a, C>
where
    C: Connector,
{
    pub fn start(self) {
        let graph = &self.formula_manager.graph;
        let rdeps_fetcher = |v: &Vertex| match graph.get_rdeps(v) {
            Some(rdeps) => rdeps.iter().map(|r| r.clone()).collect(),
            None => vec![],
        };
        let order = calc_order(&rdeps_fetcher, self.dirty_vertices);
        let formulas = &self.formula_manager.formulas;
        let names = &self.formula_manager.names;
        let CalcConfig { iter_limit, error } = self.config;
        let mut connector = self.connector;

        order.into_iter().for_each(|unit| match unit {
            CalcUnit::Cycle(vertices) => {
                let cycle_calc = CycleCalculator {
                    vertices,
                    error,
                    iter_limit,
                    connector: &mut connector,
                    names: &names,
                    formulas: &formulas,
                };
                cycle_calc.start();
            }
            CalcUnit::Node(vertex) => {
                if let Some((sheet_id, cell_id)) = get_cell_id_from_vertex(&vertex, &mut connector)
                {
                    if let Some(ast_node) = formulas.get(&(sheet_id, cell_id)) {
                        let curr_sheet = sheet_id;
                        let (row, col) = connector.get_cell_idx(sheet_id, &cell_id).unwrap();
                        connector.set_curr_cell(curr_sheet, Addr { row, col });
                        let v = calc(&ast_node, &mut connector);
                        connector.commit_calc_values((sheet_id, cell_id), v);
                    }
                }
            }
        });
    }
}

fn get_cell_id_from_vertex<C>(v: &Vertex, connector: &mut C) -> Option<(SheetId, CellId)>
where
    C: Connector,
{
    match v {
        Vertex::Range(sheet_id, range_id) => {
            let range = connector.get_range(sheet_id, range_id);
            match range {
                Range::Normal(normal_range) => match normal_range {
                    NormalRange::Single(nid) => Some((*sheet_id, CellId::NormalCell(nid))),
                    _ => None,
                },
                Range::Block(block_range) => match block_range {
                    BlockRange::Single(bid) => Some((*sheet_id, CellId::BlockCell(bid))),
                    BlockRange::AddrRange(_, _) => None,
                },
            }
        }
        _ => None,
    }
}
