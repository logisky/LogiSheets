#[macro_export]
macro_rules! log {
    () => {
        println!("{}:{}", file!(), line!());
    };
    ($($arg:tt)*) => {
        println!("{}:{}:{}", file!(), line!(), format!($($arg)*));
    };
}

#[cfg(test)]
mod tests {

    #[test]
    fn debug_println_test() {
        log!();
        log!("{}-{}", 1, 2);
    }
}
