use crate::Addr;

pub trait GetCurrAddrTrait {
    fn get_curr_addr(&self) -> Addr;
}
