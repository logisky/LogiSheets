use controller_base::{BlockId, ColId, RowId};
use im::{hashset::HashSet, Vector};

#[derive(Clone, Debug)]
pub struct IdManager {
    next_avail_row: RowId,
    next_avail_col: ColId,
    preserved_row: HashSet<RowId>,
    preserved_col: HashSet<ColId>,
    has_allocated: HashSet<(RowId, ColId)>,
    next_avail_block: BlockId,
}

impl IdManager {
    pub fn new(next_avail_row: RowId, next_avail_col: ColId, next_avail_block: BlockId) -> Self {
        IdManager {
            next_avail_row,
            next_avail_col,
            next_avail_block,
            preserved_col: HashSet::new(),
            preserved_row: HashSet::new(),
            has_allocated: HashSet::new(),
        }
    }

    pub fn get_block_id(&mut self) -> BlockId {
        let res = self.next_avail_block;
        self.next_avail_block += 1;
        res
    }

    pub fn get_row_ids(&mut self, cnt: u32) -> Vector<RowId> {
        let ids = (0..cnt)
            .map(|cnt| cnt + self.next_avail_row)
            .collect::<Vector<_>>();
        self.next_avail_row += cnt;
        ids
    }

    pub fn get_col_ids(&mut self, cnt: u32) -> Vector<ColId> {
        let ids = (0..cnt)
            .map(|cnt| cnt + self.next_avail_col)
            .collect::<Vector<_>>();
        self.next_avail_col += cnt;
        ids
    }

    pub fn get_preserved_row_ids(&mut self, row_ids: Vector<ColId>) -> RowId {
        let result_id = self
            .preserved_row
            .iter()
            .find(|p| {
                !row_ids
                    .iter()
                    .any(|c| self.has_allocated.contains(&(*p.clone(), c.clone())))
            })
            .map_or(
                {
                    let r = self.next_avail_row;
                    self.next_avail_row += 1;
                    r
                },
                |id| id.clone(),
            );
        row_ids.iter().for_each(|c| {
            self.has_allocated.insert((result_id, c.clone()));
        });
        result_id
    }

    pub fn get_preserved_col_ids(&mut self, row_ids: Vector<RowId>) -> ColId {
        let result_id = self
            .preserved_col
            .iter()
            .find(|p| {
                !row_ids
                    .iter()
                    .any(|r| self.has_allocated.contains(&(r.clone(), *p.clone())))
            })
            .map_or(
                {
                    let r = self.next_avail_col;
                    self.next_avail_col += 1;
                    r
                },
                |id| id.clone(),
            );
        row_ids.iter().for_each(|r| {
            self.has_allocated.insert((r.clone(), result_id));
        });
        result_id
    }
}
