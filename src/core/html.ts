export const escape = (badString: string) =>
    badString
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
        .replaceAll('>', '&gt;')
        .replaceAll('<', '&lt;')

export const extract = (data: string) =>
    data
        .replaceAll(/&amp;/g, '&')
        .replaceAll(/&quot;/g, '"')
        .replaceAll(/&apos;/g, "'")
        .replaceAll(/&gt;/g, '>')
        .replaceAll(/&lt;/g, '<')
