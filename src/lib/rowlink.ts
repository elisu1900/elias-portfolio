/**
 * Row-level links, derived from the row itself.
 *
 * A result row that carries a `url` of its own already says where the thing it
 * describes lives. Rather than print that address twice, the row's `name` cell
 * becomes the link to it — so `SELECT * FROM companies;` hands the visitor the
 * employer's site by clicking the employer's name.
 *
 * Nothing here knows about any particular table. The pairing is read off the
 * result's own headers, so a second company, or any later table with `name` and
 * `url` columns, is linked for free. Presentation only: the query engine never
 * sees this.
 */

/** The header that becomes the link, and the header that supplies its target. */
const LABEL_COLUMN = 'name';
const HREF_COLUMN = 'url';

/**
 * A header as the engine labelled it: `url`, or `companies.url` once a join
 * makes the bare name ambiguous. The qualifier is kept so a joined row links
 * each name to the url from its *own* table.
 */
function split(header: string): { qualifier: string; column: string } {
  const text = header.trim().toLowerCase();
  const dot = text.lastIndexOf('.');
  return dot > 0
    ? { qualifier: text.slice(0, dot), column: text.slice(dot + 1) }
    : { qualifier: '', column: text };
}

/**
 * The cell value as a safe http(s) href, or undefined when it is not one:
 * NULL, a relative path, an unparseable string, or any other scheme —
 * `javascript:` and `data:` can never reach an href through this.
 */
export function httpHref(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return undefined;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  return text;
}

/**
 * Which result columns are linkable, as `name` column index → `url` column
 * index. Empty when the result has no such pair. A qualified name takes the url
 * from the same qualifier; an unqualified one falls back to the result's single
 * url column, which is how a plain `SELECT name, url` arrives.
 */
export function linkableColumns(columns: string[]): Map<number, number> {
  const labels: Array<{ index: number; qualifier: string }> = [];
  const hrefs: Array<{ index: number; qualifier: string }> = [];

  columns.forEach((header, index) => {
    const { qualifier, column } = split(header);
    if (column === LABEL_COLUMN) labels.push({ index, qualifier });
    else if (column === HREF_COLUMN) hrefs.push({ index, qualifier });
  });

  const pairs = new Map<number, number>();
  if (!labels.length || !hrefs.length) return pairs;

  for (const label of labels) {
    const match =
      hrefs.find((href) => href.qualifier === label.qualifier) ??
      (hrefs.length === 1 ? hrefs[0] : undefined);
    if (match) pairs.set(label.index, match.index);
  }
  return pairs;
}
