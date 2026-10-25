/**
 * Foreign keys, made readable.
 *
 * The dataset is in third normal form, so a column like `experience.company_id`
 * is an honest integer and nothing on screen says "Vision Harbor Technologies"
 * unless you know to write a JOIN. A visitor who has never written SQL should
 * not have to.
 *
 * This is presentation only. It is applied when a cell is painted, so the query
 * engine's semantics are untouched: WHERE still compares the integer, ORDER BY
 * still sorts by it and COUNT(*) never sees any of this.
 *
 * Everything is derived from `relations` in ../data/db, which is generated from
 * the schema itself — so any foreign key added later is labelled for free, with
 * no list to maintain here.
 */

import { cell, getTable, relations } from '../data/db';

export type Locale = 'en' | 'es';

/**
 * Columns we are willing to read a human label from, best first. If a
 * referenced table has none of them we render the bare id rather than guess at
 * some arbitrary column.
 */
const LABEL_COLUMNS = ['name', 'title', 'full_name', 'company'];

interface Target {
  table: string;
  column: string;
}

/**
 * Unqualified column name → the row it points at. `null` marks a name used by
 * two foreign keys that point at *different* tables: unresolvable from a header
 * alone, so it gets no label.
 */
const byColumn = (() => {
  const map = new Map<string, Target | null>();
  for (const edge of relations) {
    const key = edge.from.column.toLowerCase();
    const seen = map.get(key);
    if (seen === undefined) {
      map.set(key, edge.to);
      continue;
    }
    if (seen === null) continue;
    if (seen.table !== edge.to.table || seen.column !== edge.to.column) map.set(key, null);
  }
  return map;
})();

/** `table.column` → target, so a qualified header resolves exactly. */
const byQualified = new Map<string, Target>(
  relations.map((edge) => [
    `${edge.from.table.toLowerCase()}.${edge.from.column.toLowerCase()}`,
    edge.to,
  ])
);

/**
 * Which row a result column points at, if any. Headers arrive as the engine
 * labelled them: `company_id`, or `experience.company_id` once a join makes a
 * name ambiguous, or whatever the visitor wrote after AS.
 */
function targetFor(header: string): Target | undefined {
  const name = header.trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot > 0) {
    // A qualifier may be a table name (exact) or a query alias (fall back to
    // the column name, which is how the engine resolves it too).
    return byQualified.get(name) ?? byColumn.get(name.slice(dot + 1)) ?? undefined;
  }
  return byColumn.get(name) ?? undefined;
}

/** key text → label text, per referenced table and locale. Built once, reused. */
const indexes = new Map<string, Map<string, string>>();

function labelIndex(target: Target, locale: Locale): Map<string, string> {
  const memo = `${target.table}.${target.column}.${locale}`;
  const cached = indexes.get(memo);
  if (cached) return cached;

  const index = new Map<string, string>();
  const table = getTable(target.table);
  if (table) {
    const keyColumn = table.columns.find(
      (c) => c.name.toLowerCase() === target.column.toLowerCase()
    )?.name;
    const labelColumn = LABEL_COLUMNS.reduce<string | undefined>(
      (found, candidate) =>
        found ?? table.columns.find((c) => c.name.toLowerCase() === candidate)?.name,
      undefined
    );

    if (keyColumn && labelColumn) {
      for (const row of table.rows) {
        const key = cell(row[keyColumn] ?? null, locale);
        const label = cell(row[labelColumn] ?? null, locale);
        if (key === 'NULL' || label === 'NULL' || !label) continue;
        if (!index.has(key)) index.set(key, label);
      }
    }
  }

  indexes.set(memo, index);
  return index;
}

/**
 * The human label for a foreign-key cell, or undefined when there is nothing
 * honest to add: not a foreign key, no label column on the far side, or no such
 * row. Never throws, never returns "undefined" as text.
 */
export function fkLabel(header: string, value: string, locale: Locale): string | undefined {
  if (!header || !value || value === 'NULL') return undefined;
  const target = targetFor(header);
  if (!target) return undefined;
  const label = labelIndex(target, locale).get(value);
  return label && label !== value ? label : undefined;
}
