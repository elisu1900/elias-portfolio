/**
 * ER-diagram layout, computed at build time.
 *
 * Pure geometry: it turns `schema` + `relations` into absolutely positioned
 * table nodes and SVG bezier paths whose endpoints land on the exact column
 * rows the foreign keys join. Because it runs on the server, the diagram
 * exists in the HTML with no JavaScript at all.
 */

import { relations, schema, type Table } from '../data/db';

export const METRICS = {
  nodeW: 186,
  /** Header strip height. */
  headH: 30,
  /** One column row. */
  rowH: 21,
  /** Padding under the last row. */
  footH: 8,
  gapX: 64,
  gapY: 28,
  padX: 18,
  padY: 16,
} as const;

/**
 * Hand-tuned columns: the developer hub on the left, its direct children next,
 * then the tables they reference, then the lookup and junction tables. Keeping
 * junctions in the last column puts them beside both parents they tie together,
 * so every join in the dataset is a visible pair of edges.
 */
const LAYOUT: readonly string[][] = [
  ['developer'],
  ['experience', 'education', 'certifications', 'spoken_languages', 'contact_channels'],
  ['companies', 'institutions', 'projects', 'skills', 'services'],
  ['project_skills', 'service_skills', 'skill_categories'],
];

export interface DiagramRow {
  name: string;
  type: string;
  pk: boolean;
  /** "companies.id" when this column is a foreign key. */
  fk: string | null;
  nullable: boolean;
  /** Centre of this row, relative to the canvas. */
  cy: number;
}

export interface DiagramNode {
  table: string;
  comment: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: DiagramRow[];
}

export interface DiagramEdge {
  from: string;
  to: string;
  /** "experience.company_id → companies.id", for the title/tooltip. */
  label: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Diagram {
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  tableCount: number;
  columnCount: number;
}

function nodeHeight(table: Table): number {
  return METRICS.headH + table.columns.length * METRICS.rowH + METRICS.footH;
}

/** Tables not named in LAYOUT still get placed, in the shortest column. */
function assignColumns(): string[][] {
  const columns = LAYOUT.map((c) => c.filter((name) => schema.some((t) => t.name === name)));
  const placed = new Set(columns.flat());

  for (const table of schema) {
    if (placed.has(table.name)) continue;
    let shortest = 0;
    let best = Infinity;
    columns.forEach((col, i) => {
      const total = col.reduce(
        (sum, name) => sum + nodeHeight(schema.find((t) => t.name === name)!),
        0
      );
      if (total < best) {
        best = total;
        shortest = i;
      }
    });
    columns[shortest].push(table.name);
    placed.add(table.name);
  }
  return columns;
}

export function buildDiagram(locale: 'en' | 'es'): Diagram {
  const { nodeW, headH, rowH, gapX, gapY, padX, padY } = METRICS;
  const columns = assignColumns();

  const stackHeight = (names: string[]) =>
    names.reduce((sum, name) => sum + nodeHeight(schema.find((t) => t.name === name)!), 0) +
    Math.max(0, names.length - 1) * gapY;

  const tallest = Math.max(...columns.map(stackHeight));
  const height = tallest + padY * 2;
  const width = padX * 2 + columns.length * nodeW + (columns.length - 1) * gapX;

  const nodes: DiagramNode[] = [];

  columns.forEach((names, col) => {
    // Each column is centred vertically against the tallest one.
    let y = padY + (tallest - stackHeight(names)) / 2;
    const x = padX + col * (nodeW + gapX);

    for (const name of names) {
      const table = schema.find((t) => t.name === name)!;
      const h = nodeHeight(table);
      nodes.push({
        table: table.name,
        comment: table.comment[locale],
        col,
        x,
        y: Math.round(y),
        w: nodeW,
        h,
        rows: table.columns.map((c, i) => ({
          name: c.name,
          type: c.type,
          pk: !!c.pk,
          fk: c.fk ? `${c.fk.table}.${c.fk.column}` : null,
          nullable: !!c.nullable,
          cy: Math.round(y) + headH + i * rowH + rowH / 2,
        })),
      });
      y += h + gapY;
    }
  });

  const byName = new Map(nodes.map((n) => [n.table, n]));

  const edges: DiagramEdge[] = relations.flatMap((rel) => {
    const source = byName.get(rel.from.table);
    const target = byName.get(rel.to.table);
    if (!source || !target) return [];

    const sRow = source.rows.find((r) => r.name === rel.from.column);
    const tRow = target.rows.find((r) => r.name === rel.to.column);
    if (!sRow || !tRow) return [];

    // Leave the node on the side that faces the table being referenced.
    const sameColumn = source.col === target.col;
    const leftward = sameColumn || source.col > target.col;

    const x1 = leftward ? source.x : source.x + source.w;
    const x2 = leftward ? target.x + target.w : target.x;
    const y1 = sRow.cy;
    const y2 = tRow.cy;

    // Same-column edges loop out into the gutter on the left.
    const bend = sameColumn
      ? 54
      : Math.min(120, Math.max(38, Math.abs(x2 - x1) * 0.42));
    const c1 = leftward ? x1 - bend : x1 + bend;
    const c2 = sameColumn ? x2 - bend : leftward ? x2 + bend : x2 - bend;

    return [
      {
        from: rel.from.table,
        to: rel.to.table,
        label: `${rel.from.table}.${rel.from.column} → ${rel.to.table}.${rel.to.column}`,
        d: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`,
        x1,
        y1,
        x2,
        y2,
      },
    ];
  });

  return {
    width,
    height,
    nodes,
    edges,
    tableCount: schema.length,
    columnCount: schema.reduce((sum, t) => sum + t.columns.length, 0),
  };
}
