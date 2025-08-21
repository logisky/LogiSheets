use imbl::hashmap::HashMap;
use imbl::hashset::HashSet;
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

    pub fn add_dep(&mut self, v: V, dep: V) {
        let deps = self.deps.get(&v).map_or(HashSet::new(), |d| d.clone());
        let new_deps = deps.update(dep.clone());
        let rdeps = self.rdeps.get(&dep).map_or(HashSet::new(), |r| r.clone());
        let new_rdeps = rdeps.update(v.clone());
        self.deps.insert(v.clone(), new_deps);
        self.rdeps.insert(dep.clone(), new_rdeps);
    }

    pub fn remove_dep(&mut self, v: &V, dep: &V) {
        if let Some(deps) = self.deps.get_mut(v) {
            deps.remove(dep);
        }
        if let Some(rdeps) = self.rdeps.get_mut(dep) {
            rdeps.remove(v);
        }
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
}

#[cfg(test)]
mod tests {

    use super::Graph;

    #[test]
    fn remove_dep() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //   \ / \
        //    3   7
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(4, 3);
        graph.add_dep(4, 7);
        graph.add_dep(5, 6);

        graph.remove_dep(&4, &7);

        if let Some(d) = graph.get_deps(&4) {
            assert_eq!(d.len(), 1);
            assert!(d.contains(&3));
        } else {
            panic!();
        }

        if let Some(d) = graph.get_rdeps(&7) {
            assert_eq!(d.len(), 0);
        }
    }

    #[test]
    fn delete_vertex_in_graph() {
        //    1    5
        //   / \  / \
        //  2   4    6
        //   \ / \
        //    3   7
        let mut graph = Graph::<u32>::new();
        graph.add_dep(1, 2);
        graph.add_dep(2, 3);
        graph.add_dep(1, 4);
        graph.add_dep(5, 4);
        graph.add_dep(4, 3);
        graph.add_dep(4, 7);
        graph.add_dep(5, 6);
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
