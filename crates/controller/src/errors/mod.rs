mod errors;

pub use errors::*;
pub type Result<T> = std::result::Result<T, Error>;
