mod calc_order;
pub mod calculator;
pub mod connector;
mod cycle;
use controller_base::Addr;
use im::HashSet;
use itertools::Itertools;

use crate::settings::CalcConfig;
use crate::vertex_manager::status::Status;
use crate::vertex_manager::vertex::{FormulaId, Vertex};
use crate::vertex_manager::VertexManager;
use calc_order::{calc_order, CalcUnit};

use self::connector::Connector;
use calculator::calculator::calc;
use cycle::CycleCalculator;

pub struct CalcEngine<C>
where
    C: Connector,
{
    pub vertex_manager: VertexManager,
    pub config: CalcConfig,
    pub connector: C,
}

impl<C> CalcEngine<C>
where
    C: Connector,
{
    pub fn start(self) -> HashSet<FormulaId> {
        let graph = self.vertex_manager.status.graph;
        let dirty_nodes = self.vertex_manager.dirty_nodes;
        let calc_rdeps = self.vertex_manager.calc_rdeps;
        let rdeps_fetcher = |v: &FormulaId| {
            let vertex = Vertex::Cell(v.clone());
            let graph_rdeps = graph
                .get_rdeps(&vertex)
                .and_then(|s| {
                    let rdeps = s
                        .clone()
                        .into_iter()
                        .fold(HashSet::<FormulaId>::new(), |p, vt| match vt {
                            Vertex::Cell(fid) => p.update(fid),
                            _ => p,
                        });
                    Some(rdeps)
                })
                .unwrap_or(HashSet::new());
            let t_rdeps = calc_rdeps.get(v);
            match t_rdeps {
                Some(rdeps) => graph_rdeps.union(rdeps.clone()).into_iter().collect_vec(),
                None => graph_rdeps.into_iter().collect_vec(),
            }
        };
        let order = calc_order(&rdeps_fetcher, dirty_nodes);
        let formulas = self.vertex_manager.status.formulas;
        let names = self.vertex_manager.status.names;
        let CalcConfig { iter_limit, error } = self.config;
        let mut connector = self.connector;

        let mut dirties = HashSet::<FormulaId>::new();
        order.into_iter().for_each(|unit| match unit {
            CalcUnit::Cycle(fids) => {
                let cycle_calc = CycleCalculator {
                    vertices: fids,
                    error,
                    iter_limit,
                    connector: &mut connector,
                    names: &names,
                    formulas: &formulas,
                };
                let dirty = cycle_calc.start();
                dirties.extend(dirty);
            }
            CalcUnit::Node(fid) => {
                if let Some(ast_node) = formulas.get(&fid) {
                    let curr_sheet = fid.0;
                    let curr_addr = connector
                        .get_cell_idx(curr_sheet, &fid.1)
                        .map_or(Addr::default(), |(row, col)| Addr { row, col });
                    connector.set_curr_cell(curr_sheet, curr_addr);
                    let v = calc(&ast_node, &mut connector);
                    let dirty = connector.commit_calc_values(fid, v.clone());
                    dirties.extend(dirty);
                }
            }
        });
        if dirties.len() > 0 {
            let vm = VertexManager {
                status: Status {
                    graph,
                    formulas,
                    names,
                    range_vertices: self.vertex_manager.status.range_vertices,
                    sts_vertices: self.vertex_manager.status.sts_vertices,
                },
                dirty_nodes: dirties,
                calc_rdeps: im::HashMap::new(),
            };
            let config = CalcConfig { iter_limit, error };
            let engine = CalcEngine {
                vertex_manager: vm,
                config,
                connector,
            };
            engine.start();
        }
        HashSet::new()
    }
}
