use im::hashmap::HashMap;
use im::hashset::HashSet;
use std::hash::Hash;

#[derive(Debug, Clone, Default)]
pub struct Graph<V>
where
    V: Hash + Eq + Clone,
{
    pub deps: HashMap<V, HashSet<V>>,
    pub rdeps: HashMap<V, HashSet<V>>,
}

impl<V> Graph<V>
where
    V: Hash + Eq + Clone,
{
    pub fn new() -> Self {
        Graph {
            deps: HashMap::new(),
            rdeps: HashMap::new(),
        }
    }

    pub fn add_dep(self, v: V, dep: V) -> Self {
        let mut curr = self.clone();
        let deps = self.deps.get(&v).map_or(HashSet::new(), |d| d.clone());
        let new_deps = deps.update(dep.clone());
        let rdeps = self.rdeps.get(&dep).map_or(HashSet::new(), |r| r.clone());
        let new_rdeps = rdeps.update(v.clone());
        curr.deps.insert(v.clone(), new_deps);
        curr.rdeps.insert(dep.clone(), new_rdeps);
        curr
    }

    pub fn get_deps(&self, v: &V) -> Option<&HashSet<V>> {
        self.deps.get(v)
    }

    pub fn get_rdeps(&self, v: &V) -> Option<&HashSet<V>> {
        self.rdeps.get(v)
    }

    pub fn delete_vertex(self, vertex: &V) -> Self {
        let new_rdeps = {
            let mut new_rdeps = self.rdeps.clone();
            if let Some(deps) = self.deps.clone().get(vertex) {
                deps.iter().for_each(|d| {
                    if let Some(drdep) = new_rdeps.get(d) {
                        let new_drdep = drdep.clone().without(vertex);
                        new_rdeps.insert(d.clone(), new_drdep);
                    }
                })
            }
            new_rdeps.without(vertex)
        };
        let new_deps = {
            let mut new_deps = self.deps.clone();
            if let Some(rdeps) = self.rdeps.clone().get(vertex) {
                rdeps.iter().for_each(|r| {
                    if let Some(rdepd) = new_deps.get(r) {
                        let new_rdepd = rdepd.clone().without(vertex);
                        new_deps.insert(r.clone(), new_rdepd);
                    }
                })
            }
            new_deps.without(vertex)
        };
        Graph {
            deps: new_deps,
            rdeps: new_rdeps,
        }
    }

    pub fn convert_vertex(self, old_vertex: &V, new_vertex: V) -> Self {
        let new_rdeps = {
            let mut new_rdeps = self.rdeps.clone().without(old_vertex);
            let old_rdeps = self.rdeps.get(old_vertex);
            if let Some(d) = old_rdeps {
                let mut new_vertex_rdeps = new_rdeps
                    .get(&new_vertex)
                    .map_or(HashSet::from(vec![]), |s| s.clone());
                d.iter().for_each(|element| {
                    new_vertex_rdeps.insert(element.clone());
                });
                new_rdeps.insert(new_vertex.clone(), new_vertex_rdeps);
            }
            let old_deps = self.deps.get(old_vertex);
            if let Some(d) = old_deps {
                d.iter().fold(new_rdeps, |prev, v| {
                    let curr_rdeps = prev
                        .get(v)
                        .map_or(HashSet::from(vec![new_vertex.clone()]), |r| {
                            r.update(new_vertex.clone()).without(old_vertex)
                        });
                    prev.update(v.clone(), curr_rdeps)
                })
            } else {
                new_rdeps
            }
        };
        let new_deps = {
            let mut new_deps = self.deps.clone();
            let old_deps = self.deps.get(old_vertex);
            if let Some(d) = old_deps {
                let mut new_vertex_deps = new_deps
                    .get(&new_vertex)
                    .map_or(HashSet::from(vec![]), |s| s.clone());
                d.iter().for_each(|element| {
                    new_vertex_deps.insert(element.clone());
                });
                new_deps.insert(new_vertex.clone(), new_vertex_deps);
            }
            let old_rdeps = self.rdeps.get(old_vertex);
            if let Some(d) = old_rdeps {
                d.iter().fold(new_deps.without(old_vertex), |prev, v| {
                    let curr_deps = prev
                        .get(v)
                        .map_or(HashSet::from(vec![new_vertex.clone()]), |r| {
                            r.update(new_vertex.clone()).without(old_vertex)
                        });
                    prev.update(v.clone(), curr_deps)
                })
            } else {
                new_deps.without(old_vertex)
            }
        };
        Graph {
            deps: new_deps,
            rdeps: new_rdeps,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Graph;
    #[test]
    fn convert_vertext_has_existed() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let graph = Graph::<u32>::new()
            .add_dep(1, 2)
            .add_dep(2, 3)
            .add_dep(1, 4)
            .add_dep(5, 4)
            .add_dep(5, 6);
        let new_graph = graph.convert_vertex(&1, 5);
        if let Some(rdep) = new_graph.rdeps.get(&4) {
            assert_eq!(rdep.len(), 1);
            assert!(rdep.contains(&5));
        } else {
            panic!()
        }
        if let Some(rdep) = new_graph.rdeps.get(&2) {
            assert_eq!(rdep.len(), 1);
            assert!(rdep.contains(&5));
        } else {
            panic!()
        }
        assert!(matches!(new_graph.deps.get(&1), None));
    }

    #[test]
    fn convert_vertex_in_graph() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let graph = Graph::<u32>::new()
            .add_dep(1, 2)
            .add_dep(2, 3)
            .add_dep(1, 4)
            .add_dep(5, 4)
            .add_dep(5, 6);
        let new_graph = graph.convert_vertex(&1, 7);
        if let Some(d) = new_graph.deps.get(&7) {
            assert_eq!(d.len(), 2);
            assert!(d.contains(&2));
            assert!(d.contains(&4));
        } else {
            panic!()
        }
    }

    #[test]
    fn convert_vertex_in_graph2() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //  |
        //  3
        let graph = Graph::<u32>::new()
            .add_dep(1, 2)
            .add_dep(2, 3)
            .add_dep(1, 4)
            .add_dep(5, 4)
            .add_dep(5, 6);
        let new_graph = graph.convert_vertex(&4, 6);
        if let Some(d) = new_graph.deps.get(&1) {
            assert_eq!(d.len(), 2);
            assert!(d.contains(&2));
            assert!(d.contains(&6));
        } else {
            panic!()
        }
        if let Some(d) = new_graph.deps.get(&5) {
            assert_eq!(d.len(), 1);
            assert!(d.contains(&6));
        } else {
            panic!()
        }
    }

    #[test]
    fn delete_vertex_in_graph() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //   \ / \
        //    3   7
        let graph = Graph::<u32>::new()
            .add_dep(1, 2)
            .add_dep(2, 3)
            .add_dep(1, 4)
            .add_dep(5, 4)
            .add_dep(4, 3)
            .add_dep(4, 7)
            .add_dep(5, 6);
        let new_graph = graph.delete_vertex(&4);
        if let Some(d) = new_graph.deps.get(&1) {
            assert_eq!(d.len(), 1);
            assert!(d.contains(&2));
        } else {
            panic!()
        }
        if let Some(d) = new_graph.deps.get(&5) {
            assert_eq!(d.len(), 1);
            assert!(d.contains(&6));
        } else {
            panic!()
        }
        if let Some(d) = new_graph.rdeps.get(&7) {
            assert_eq!(d.len(), 0);
        } else {
            panic!()
        }
        if let Some(d) = new_graph.rdeps.get(&3) {
            assert_eq!(d.len(), 1);
            assert!(d.contains(&2));
        } else {
            panic!()
        }
    }
}
