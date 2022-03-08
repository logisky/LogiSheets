use syn::DeriveInput;

use crate::container::{self, Field, EleType, Container};

pub struct DeFields<'a> {
    pub children: Vec<Field<'a>>,
    pub text: Option<Field<'a>>,
    pub attrs: Vec<Field<'a>>,
    pub self_closed_children: Vec<Field<'a>>,
}

impl<'a> DeFields<'a> {
    pub fn from_fields(fields: Vec<Field<'a>>) -> Self {
        let mut result = DeFields {
            children: vec![],
            text: None,
            attrs: vec![],
            self_closed_children: vec![],
        };
        fields.into_iter().for_each(|f| {
            match f.ty {
                EleType::Attr => result.attrs.push(f),
                EleType::Child => result.children.push(f),
                EleType::Text => result.text = Some(f),
                EleType::SelfClosedChild => result.self_closed_children.push(f),
            }
        });
        result
    }
}

pub fn get_de_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Container::from_ast(&input, container::Derive::Deserialize);
    let DeFields {
        children,
        text,
        attrs,
        self_closed_children,
    }= DeFields::from_fields(container.fields);
    let vec_init = get_vec_init(&children);
    let attr_branches = attrs
        .into_iter()
        .map(|a| attr_match_branch(a));
    let child_branches = children_match_branch(children);
    let sfc_branch = sfc_match_branch(self_closed_children);
    let ident = &input.ident;
    let text_branch = {
        if let Some(t) = text {
            Some(text_match_branch(t))
        } else {
            None
        }
    };
    quote!{
        impl crate::XmlDeserialize for #ident {
            fn deserialize<B: std::io::BufRead>(
                tag: &[u8],
                reader: &mut quick_xml::Reader<B>,
                attrs: quick_xml::events::attributes::Attributes,
            ) -> Self {
                let mut result = #ident::default();
                attrs.into_iter().for_each(|attr| {
                    if let Ok(attr) = attr {
                        match attr.key {
                            #(#attr_branches)*
                            _ => {},
                        }
                    }
                });
                let mut buf = Vec::<u8>::new();
                use quick_xml::events::Event;
                #vec_init
                loop {
                    match reader.read_event(&mut buf) {
                        Ok(Event::End(e)) => {
                            if e.name() == tag {
                                break
                            }
                        },
                        #child_branches
                        #text_branch
                        #sfc_branch
                        Ok(Event::Eof) => break,
                        Err(_) => break,
                        _ => {},
                    }
                }
                result
            }
        }
    }
}

fn get_vec_init(children: &Vec<Field>) -> proc_macro2::TokenStream {
    let vec_inits= children
        .iter()
        .filter(|c| c.vec_ty.is_some())
        .map(|c| {
            match &c.vec_size {
            Some(lit) => {
                let vec_ty = &c.vec_ty.unwrap();
                let ident = c.original.ident.as_ref().unwrap();
                match lit {
                    syn::Lit::Str(_) => {
                        let path = container::parse_lit_into_expr_path(lit).unwrap();
                        quote!{
                            result.#ident = Vec::<#vec_ty>::with_capacity(result.#path as usize);
                        }
                    },
                    syn::Lit::Int(i) => {
                        quote!{
                            result.#ident = Vec::<#vec_ty>::with_capacity(#i);
                        }
                    },
                    _ => panic!(""),
                }
            },
            None => {
                quote!{}
            },
        }
    });
    quote! {
        #(#vec_inits)*
    }
}

fn sfc_match_branch(fields: Vec<Field>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote!{}
    }
    let mut idents = vec![];
    let mut tags = vec![];
    fields.iter().for_each(|f| {
        if !matches!(f.ty, EleType::SelfClosedChild) {
            panic!("")
        }
        let tag = f.name.as_ref().unwrap();
        tags.push(tag);
        let ident = f.original.ident.as_ref().unwrap();
        idents.push(ident);
    });
    quote! {
        Ok(Event::Empty(s)) => {
            match s.name() {
                #(#tags => {result.#idents = true;})*
                _ => {},
            }
        },
    }
}


fn attr_match_branch(field: Field) -> proc_macro2::TokenStream {
    if !matches!(field.ty, EleType::Attr) {
        panic!("")
    }
    let t = &field.original.ty;
    let tag = field.name.as_ref().unwrap();
    let ident = field.original.ident.as_ref().unwrap();
    quote! {
        #tag => {
            let s = String::from_utf8(attr.value.into_iter().map(|c| *c).collect()).unwrap();
            match #t::deserialize(&s) {
                Ok(v) => {
                    result.#ident = v;
                },
                Err(_) => {
                    // If we used format! here. It would panic!.
                    // let err_msg = format!("xml value deserialize error: {:?} to {:?}", s, #t);
                    panic!("deserialize failed")
                },
            }
        },
    }
}

fn text_match_branch(field: Field) -> proc_macro2::TokenStream {
    if !matches!(field.ty, EleType::Text) {
        panic!("")
    }
    let ident = field.original.ident.as_ref().unwrap();
    let t = &field.original.ty;
    quote! {
        Ok(Event::Text(s)) => {
            let r = s.unescape_and_decode(reader).unwrap();
            match #t::deserialize(&r) {
                Ok(v) => {
                    result.#ident = v;
                },
                Err(_) => {
                    panic!("deserialize failed")
                }
            }
        },
    }
}

fn children_match_branch(fields: Vec<Field>) -> proc_macro2::TokenStream {
    if fields.len() == 0 {
        return quote!{}
    }
    let mut branches= vec![];
    fields.iter().for_each(|f| {
        if !matches!(f.ty, EleType::Child) {
            panic!("")
        }
        let tag = f.name.as_ref().unwrap();
        let ident = f.original.ident.as_ref().unwrap();
        let t = &f.original.ty;
        let size = &f.vec_size;
        let branch = if size.is_none() {
            quote! {
                #tag => {
                    let f = #t::deserialize(#tag, reader, s.attributes());
                    result.#ident = f;
                },
            }
        } else {
            let vec_ty = f.vec_ty.unwrap();
            quote! {
                #tag => {
                    let ele = #vec_ty::deserialize(#tag, reader, s.attributes());
                    result.#ident.push(ele);
                }
            }
        };
        branches.push(branch);
    });
    quote!{
        Ok(Event::Start(s)) => {
            match s.name() {
                #(#branches)*
                _ => {},
            }
        }
    }
}
