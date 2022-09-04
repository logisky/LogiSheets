pub fn remove_ext(s: &str) -> String {
    s.strip_suffix(".ts").unwrap_or(s).to_string()
}
