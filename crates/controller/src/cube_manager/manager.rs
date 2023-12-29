use im::HashMap;
use logisheets_base::{Cube, CubeId};

#[derive(Debug, Clone)]
pub struct CubeManager {
    pub id_to_cube: HashMap<CubeId, Cube>,
    pub cube_to_id: HashMap<Cube, CubeId>,
    pub next_id: CubeId,
}

impl CubeManager {
    pub fn new() -> CubeManager {
        CubeManager {
            id_to_cube: HashMap::new(),
            cube_to_id: HashMap::new(),
            next_id: 0,
        }
    }

    pub fn remove_cube(&mut self, cube_id: &CubeId) {
        if let Some(cube) = self.id_to_cube.remove(cube_id) {
            self.cube_to_id.remove(&cube);
        }
    }

    pub fn get_cube(&self, cube_id: &CubeId) -> Option<Cube> {
        Some(self.id_to_cube.get(cube_id)?.clone())
    }

    pub fn get_cube_id(&mut self, cube: &Cube) -> CubeId {
        if let Some(id) = self.cube_to_id.get(cube) {
            *id
        } else {
            let id = self.next_id;
            let c = cube.clone();
            self.cube_to_id.insert(c, id);
            self.id_to_cube.insert(id, c);
            self.next_id += 1;
            id
        }
    }
}
