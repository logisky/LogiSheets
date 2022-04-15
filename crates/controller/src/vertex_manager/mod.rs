pub mod context;
pub mod executors;
pub mod graph;
pub mod status;
mod update_ast;
pub mod vertex;

use crate::payloads::sheet_process::SheetProcess;
use std::hash::Hash;

use self::context::ContextTrait;
use self::executors::{exec::exec, ExecuteResult};
use self::status::Status;
use self::vertex::FormulaId;
use im::{HashMap, HashSet};

#[derive(Debug, Clone, Default)]
pub struct VertexManager {
    pub status: Status,
    pub dirty_nodes: HashSet<FormulaId>,
    pub calc_rdeps: HashMap<FormulaId, HashSet<FormulaId>>,
}

impl VertexManager {
    pub fn execute_sheet_proc<T>(self, proc: SheetProcess, ctx: &mut T) -> Self
    where
        T: ContextTrait,
    {
        let init = ExecuteResult {
            status: self.status,
            dirty_nodes: HashSet::new(),
            calc_rdeps: HashMap::new(),
        };
        let result = exec(init, proc, ctx);
        VertexManager {
            status: result.status,
            dirty_nodes: self.dirty_nodes.union(result.dirty_nodes),
            calc_rdeps: merge_calc_rdeps(result.calc_rdeps, self.calc_rdeps),
        }
    }

    pub fn clone_for_calc(&mut self) -> Self {
        let mut dirty_nodes = HashSet::new();
        let mut calc_rdeps = HashMap::new();
        std::mem::swap(&mut self.dirty_nodes, &mut dirty_nodes);
        std::mem::swap(&mut self.calc_rdeps, &mut calc_rdeps);
        VertexManager {
            status: self.status.clone(),
            dirty_nodes,
            calc_rdeps,
        }
    }
}

fn merge_calc_rdeps<T, V>(
    rdeps1: HashMap<T, HashSet<V>>,
    rdeps2: HashMap<T, HashSet<V>>,
) -> HashMap<T, HashSet<V>>
where
    T: Clone + Hash + Eq,
    V: Clone + Hash + Eq,
{
    rdeps2.into_iter().fold(rdeps1, |prev, (fid, rdeps)| {
        if let Some(has_rdeps) = prev.get(&fid) {
            let rdeps = rdeps
                .into_iter()
                .fold(has_rdeps.clone(), |prev_rdeps, rdep| {
                    prev_rdeps.update(rdep)
                });
            prev.update(fid.clone(), rdeps)
        } else {
            prev.update(fid.clone(), rdeps)
        }
    })
}
