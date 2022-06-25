use std::collections::HashSet;
use std::io::{Cursor, Read};

use xmldiff::diff;
use zip::ZipArchive;

pub fn zipdiff(zip1: &[u8], zip2: &[u8]) {
    let mut archive1 = ZipArchive::new(Cursor::new(zip1)).unwrap();
    let mut archive2 = ZipArchive::new(Cursor::new(zip2)).unwrap();
    let files1 = archive1
        .file_names()
        .map(|s| String::from(s))
        .collect::<HashSet<_>>();
    let files2 = archive2
        .file_names()
        .map(|s| String::from(s))
        .collect::<HashSet<_>>();

    for x in files1.difference(&files2) {
        println!("missing files: {}", x);
    }
    for y in files2.difference(&files1) {
        println!("importing files: {}", y);
    }
    for p in files1.intersection(&files2) {
        let mut file1 = archive1.by_name(p).unwrap();
        let mut file2 = archive2.by_name(p).unwrap();
        let mut content1 = Vec::<u8>::new();
        let mut content2 = Vec::<u8>::new();
        file1.read_to_end(&mut content1).unwrap();
        file2.read_to_end(&mut content2).unwrap();
        let str1 = String::from_utf8(content1).unwrap();
        let str2 = String::from_utf8(content2).unwrap();
        let diffs = diff(&str1, &str2);
        if diffs.len() > 0 {
            println!("Find diffs in file: {}", p);
            println!("{:?}", diffs);
        }
    }
    return;
}
