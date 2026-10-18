/**
 * A tiny, dependency-free SQL engine over the portfolio dataset.
 *
 * Pure and synchronous: `runQuery(input, locale)` takes what the visitor typed
 * and hands back a renderable result. It knows nothing about the DOM, so it is
 * trivially testable with node and safe to run on the server or the client.
 *
 * Deliberately imports only `../data/db` and `../i18n/ui` — never `site.ts`,
 * which holds the private email address that must stay out of the bundle.
 *
 * Supported subset:
 *   SELECT * | <alias>.* | col | <alias>.col | COUNT(*)   [AS alias]
 *   FROM <table> [[AS] alias]
 *   [[INNER | LEFT [OUTER]] JOIN <table> [[AS] alias] ON a.x = b.y [AND …]]…
 *   [WHERE <cond> [AND | OR <cond>]…]   = != <> > < >= <= LIKE, IS [NOT] NULL
 *   [ORDER BY <col | alias> [ASC | DESC]]
 *   [LIMIT <n>]
 *   \dt   \d <table>   \?   clear
 *
 * The dataset is in third normal form, so joins are the point: the engine
 * supports them properly rather than pretending.
 */

import { cell, getTable, schema, tableNames, type Table, type Value } from '../data/db';
import { ui } from '../i18n/ui';

export type Locale = 'en' | 'es';

type DbKey = Extract<keyof (typeof ui)['en'], `db.${string}`>;

function tr(locale: Locale, key: DbKey): string {
  return (ui[locale] as Record<string, string>)[key] ?? (ui.en as Record<string, string>)[key];
}

/* ── Result shapes ──────────────────────────────────────────────── */

export interface NoticeLine {
  /** A literal command or SQL fragment, rendered as code. */
  cmd?: string;
  text: string;
}

export interface ResultTable {
  kind: 'table';
  columns: string[];
  rows: string[][];
  /** psql-style footer: "3 rows", or the "no rows" notice. */
  notice: string;
}
export interface ResultError {
  kind: 'error';
  message: string;
}
export interface ResultNotice {
  kind: 'notice';
  lines: NoticeLine[];
}
export interface ResultClear {
  kind: 'clear';
}

export type QueryResult = ResultTable | ResultError | ResultNotice | ResultClear;

/* ── Errors ─────────────────────────────────────────────────────── */

type ErrorKind = 'syntax' | 'relation' | 'column';

class SqlError extends Error {
  kind: ErrorKind;
  token: string;
  constructor(kind: ErrorKind, token: string) {
    super(`${kind}: ${token}`);
    this.kind = kind;
    this.token = token;
  }
}

function messageFor(err: SqlError, locale: Locale): string {
  const key: DbKey =
    err.kind === 'relation'
      ? 'db.errRelation'
      : err.kind === 'column'
        ? 'db.errColumn'
        : 'db.errSyntax';
  const token = err.token.trim();
  return token ? `${tr(locale, key)} ${token}` : tr(locale, key);
}

/* ── Tokenizer ──────────────────────────────────────────────────── */

type TokenType = 'word' | 'string' | 'number' | 'op' | 'punct';

interface Token {
  type: TokenType;
  /** Unquoted text for strings, raw source otherwise. */
  value: string;
  pos: number;
}

const OPERATORS = ['>=', '<=', '<>', '!=', '=', '>', '<'];
const PUNCT = '*,();.';

/** The offending run of text at `pos`, for a psql-ish "at or near" message. */
function nearText(src: string, pos: number): string {
  const rest = src.slice(pos);
  const m = /^\S{1,24}/.exec(rest);
  return m ? m[0] : rest.slice(0, 24);
}

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      let value = '';
      for (;;) {
        if (j >= src.length) throw new SqlError('syntax', nearText(src, i));
        if (src[j] === "'") {
          // '' inside a string literal is an escaped quote, as in SQL.
          if (src[j + 1] === "'") {
            value += "'";
            j += 2;
            continue;
          }
          j++;
          break;
        }
        value += src[j++];
      }
      out.push({ type: 'string', value, pos: i });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^-?\d+(?:\.\d+)?/.exec(src.slice(i))!;
      out.push({ type: 'number', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ type: 'word', value: m[0], pos: i });
      i += m[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ type: 'op', value: op, pos: i });
      i += op.length;
      continue;
    }
    if (PUNCT.includes(ch)) {
      out.push({ type: 'punct', value: ch, pos: i });
      i++;
      continue;
    }
    throw new SqlError('syntax', nearText(src, i));
  }
  return out;
}

/* ── AST ────────────────────────────────────────────────────────── */

interface Ref {
  qualifier?: string;
  name: string;
}

interface Literal {
  kind: 'string' | 'number' | 'boolean' | 'null';
  value: string | number | boolean | null;
}

type Predicate =
  | { type: 'cmp'; ref: Ref; op: string; value: Literal }
  | { type: 'like'; ref: Ref; pattern: string; negated: boolean }
  | { type: 'null'; ref: Ref; negated: boolean };

type Expr = Predicate | { type: 'and' | 'or'; left: Expr; right: Expr };

type SelectItem =
  | { kind: 'star'; qualifier?: string }
  | { kind: 'column'; ref: Ref; alias?: string }
  | { kind: 'count'; alias?: string };

interface FromSource {
  table: string;
  alias: string;
}

interface JoinClause extends FromSource {
  outer: boolean;
  on: { left: Ref; right: Ref }[];
}

interface SelectAst {
  items: SelectItem[];
  from: FromSource;
  joins: JoinClause[];
  where?: Expr;
  orderBy?: { ref: Ref; desc: boolean };
  limit?: number;
}

/* ── Parser ─────────────────────────────────────────────────────── */

const RESERVED = new Set([
  'select',
  'from',
  'where',
  'order',
  'by',
  'group',
  'having',
  'limit',
  'offset',
  'and',
  'or',
  'not',
  'like',
  'ilike',
  'is',
  'null',
  'asc',
  'desc',
  'as',
  'count',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'outer',
  'on',
  'using',
  'union',
  'true',
  'false',
]);

class Cursor {
  tokens: Token[];
  src: string;
  private i = 0;

  constructor(tokens: Token[], src: string) {
    this.tokens = tokens;
    this.src = src;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.i + offset];
  }
  next(): Token | undefined {
    return this.tokens[this.i++];
  }
  done(): boolean {
    return this.i >= this.tokens.length;
  }
  isWord(word: string, offset = 0): boolean {
    const t = this.peek(offset);
    return !!t && t.type === 'word' && t.value.toLowerCase() === word;
  }
  eatWord(word: string): boolean {
    if (this.isWord(word)) {
      this.i++;
      return true;
    }
    return false;
  }
  eatPunct(ch: string): boolean {
    const t = this.peek();
    if (t && t.type === 'punct' && t.value === ch) {
      this.i++;
      return true;
    }
    return false;
  }
  /** Raises a syntax error pointing at the current token (or end of input). */
  fail(): never {
    const t = this.peek();
    throw new SqlError('syntax', t ? nearText(this.src, t.pos) : this.src.trim().slice(-24));
  }
  identifier(): string {
    const t = this.peek();
    if (!t || t.type !== 'word' || RESERVED.has(t.value.toLowerCase())) this.fail();
    this.i++;
    return t.value;
  }
}

/** `name` or `qualifier.name`. */
function parseRef(cur: Cursor): Ref {
  const first = cur.identifier();
  if (cur.peek()?.type === 'punct' && cur.peek()!.value === '.') {
    cur.next();
    return { qualifier: first, name: cur.identifier() };
  }
  return { name: first };
}

function parseAlias(cur: Cursor): string | undefined {
  if (cur.eatWord('as')) return cur.identifier();
  const t = cur.peek();
  if (t && t.type === 'word' && !RESERVED.has(t.value.toLowerCase())) {
    cur.next();
    return t.value;
  }
  return undefined;
}

function parseSource(cur: Cursor): FromSource {
  const table = cur.identifier();
  const alias = parseAlias(cur);
  return { table, alias: alias ?? table };
}

function parseSelect(cur: Cursor): SelectAst {
  if (!cur.eatWord('select')) cur.fail();

  const items: SelectItem[] = [];
  do {
    if (cur.eatPunct('*')) {
      items.push({ kind: 'star' });
      continue;
    }
    if (cur.isWord('count')) {
      cur.next();
      if (!cur.eatPunct('(')) cur.fail();
      if (!cur.eatPunct('*')) cur.fail();
      if (!cur.eatPunct(')')) cur.fail();
      items.push({ kind: 'count', alias: cur.eatWord('as') ? cur.identifier() : undefined });
      continue;
    }
    // `alias.*`
    if (
      cur.peek()?.type === 'word' &&
      cur.peek(1)?.type === 'punct' &&
      cur.peek(1)!.value === '.' &&
      cur.peek(2)?.type === 'punct' &&
      cur.peek(2)!.value === '*'
    ) {
      const qualifier = cur.identifier();
      cur.next();
      cur.next();
      items.push({ kind: 'star', qualifier });
      continue;
    }
    const ref = parseRef(cur);
    items.push({ kind: 'column', ref, alias: cur.eatWord('as') ? cur.identifier() : undefined });
  } while (cur.eatPunct(','));

  if (!cur.eatWord('from')) cur.fail();
  const from = parseSource(cur);

  const joins: JoinClause[] = [];
  for (;;) {
    let outer = false;
    if (cur.isWord('join') || cur.isWord('inner') || cur.isWord('left')) {
      if (cur.eatWord('inner')) {
        if (!cur.eatWord('join')) cur.fail();
      } else if (cur.eatWord('left')) {
        outer = true;
        cur.eatWord('outer');
        if (!cur.eatWord('join')) cur.fail();
      } else {
        cur.next(); // bare JOIN
      }
    } else {
      break;
    }

    const source = parseSource(cur);
    if (!cur.eatWord('on')) cur.fail();
    const on: { left: Ref; right: Ref }[] = [];
    do {
      const left = parseRef(cur);
      const opTok = cur.peek();
      if (!opTok || opTok.type !== 'op' || opTok.value !== '=') cur.fail();
      cur.next();
      on.push({ left, right: parseRef(cur) });
    } while (cur.eatWord('and'));
    joins.push({ ...source, outer, on });
  }

  const ast: SelectAst = { items, from, joins };

  if (cur.eatWord('where')) ast.where = parseExpr(cur);

  if (cur.eatWord('order')) {
    if (!cur.eatWord('by')) cur.fail();
    const ref = parseRef(cur);
    let desc = false;
    if (cur.eatWord('desc')) desc = true;
    else cur.eatWord('asc');
    ast.orderBy = { ref, desc };
  }

  if (cur.eatWord('limit')) {
    const t = cur.next();
    if (!t || t.type !== 'number' || t.value.includes('.') || Number(t.value) < 0) cur.fail();
    ast.limit = Number(t.value);
  }

  cur.eatPunct(';');
  if (!cur.done()) cur.fail();
  return ast;
}

/** OR binds loosest, AND tighter — the same precedence as real SQL. */
function parseExpr(cur: Cursor): Expr {
  let left = parseAndExpr(cur);
  while (cur.eatWord('or')) left = { type: 'or', left, right: parseAndExpr(cur) };
  return left;
}

function parseAndExpr(cur: Cursor): Expr {
  let left: Expr = parsePredicate(cur);
  while (cur.eatWord('and')) left = { type: 'and', left, right: parsePredicate(cur) };
  return left;
}

function parsePredicate(cur: Cursor): Predicate {
  const ref = parseRef(cur);

  if (cur.eatWord('is')) {
    const negated = cur.eatWord('not');
    if (!cur.eatWord('null')) cur.fail();
    return { type: 'null', ref, negated };
  }

  let negated = false;
  if (cur.eatWord('not')) negated = true;

  if (cur.eatWord('like') || cur.eatWord('ilike')) {
    const t = cur.peek();
    if (!t || t.type !== 'string') cur.fail();
    cur.next();
    return { type: 'like', ref, pattern: t.value, negated };
  }
  if (negated) cur.fail();

  const opTok = cur.peek();
  if (!opTok || opTok.type !== 'op') cur.fail();
  cur.next();
  return { type: 'cmp', ref, op: opTok.value, value: parseLiteral(cur) };
}

function parseLiteral(cur: Cursor): Literal {
  const t = cur.peek();
  if (!t) cur.fail();
  if (t.type === 'string') {
    cur.next();
    return { kind: 'string', value: t.value };
  }
  if (t.type === 'number') {
    cur.next();
    return { kind: 'number', value: Number(t.value) };
  }
  if (t.type === 'word') {
    const w = t.value.toLowerCase();
    if (w === 'true' || w === 'false') {
      cur.next();
      return { kind: 'boolean', value: w === 'true' };
    }
    if (w === 'null') {
      cur.next();
      return { kind: 'null', value: null };
    }
  }
  cur.fail();
}

/* ── Execution ──────────────────────────────────────────────────── */

interface Source {
  alias: string;
  table: Table;
}

/** One output row: alias → that table's row, or null for an unmatched LEFT JOIN. */
type JoinedRow = Record<string, Record<string, Value> | null>;

interface Resolved {
  alias: string;
  column: string;
}

function resolveTable(name: string): Table {
  const table = getTable(name.toLowerCase());
  if (!table) throw new SqlError('relation', name);
  return table;
}

function columnOf(table: Table, name: string): string | undefined {
  return table.columns.find((c) => c.name.toLowerCase() === name.toLowerCase())?.name;
}

function resolveRef(sources: Source[], ref: Ref): Resolved {
  if (ref.qualifier) {
    const q = ref.qualifier.toLowerCase();
    const source = sources.find(
      (s) => s.alias.toLowerCase() === q || s.table.name.toLowerCase() === q
    );
    if (!source) throw new SqlError('relation', ref.qualifier);
    const column = columnOf(source.table, ref.name);
    if (!column) throw new SqlError('column', `${ref.qualifier}.${ref.name}`);
    return { alias: source.alias, column };
  }
  const hits = sources
    .map((s) => ({ alias: s.alias, column: columnOf(s.table, ref.name) }))
    .filter((h): h is Resolved => !!h.column);
  // Nothing found, or ambiguous across joined tables: either way the name is
  // not usable on its own.
  if (hits.length !== 1) throw new SqlError('column', ref.name);
  return hits[0];
}

function valueAt(row: JoinedRow, at: Resolved): Value {
  const source = row[at.alias];
  if (!source) return null;
  const v = source[at.column];
  return v === undefined ? null : v;
}

function numeric(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Lowercases and strips accents, so LIKE '%malaga%' finds "Málaga". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function likeToRegExp(pattern: string): RegExp {
  let out = '';
  for (const ch of fold(pattern)) {
    if (ch === '%') out += '[\\s\\S]*';
    else if (ch === '_') out += '[\\s\\S]';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/**
 * Compares one cell against a literal. Localized prose and arrays go through
 * `cell()`, so a WHERE written in Spanish matches the Spanish text. String
 * comparison is case-insensitive — friendlier than psql, and nobody poking at a
 * portfolio console should lose to a capital letter.
 */
function evalCmp(raw: Value, op: string, lit: Literal, locale: Locale): boolean {
  if (raw === null || lit.kind === 'null') return false;

  let cmp: number;
  if (typeof raw === 'boolean' || lit.kind === 'boolean') {
    const a = typeof raw === 'boolean' ? Number(raw) : numeric(cell(raw, locale));
    const b = lit.kind === 'boolean' ? Number(lit.value) : numeric(String(lit.value));
    if (a === null || b === null) return false;
    cmp = a - b;
  } else if (lit.kind === 'number') {
    const a = typeof raw === 'number' ? raw : numeric(cell(raw, locale));
    if (a === null) return false;
    cmp = a - (lit.value as number);
  } else {
    // 'base' ignores case and accents: 'malaga' finds 'Málaga'.
    cmp = cell(raw, locale).localeCompare(String(lit.value), locale, { sensitivity: 'base' });
  }

  switch (op) {
    case '=':
      return cmp === 0;
    case '!=':
    case '<>':
      return cmp !== 0;
    case '>':
      return cmp > 0;
    case '<':
      return cmp < 0;
    case '>=':
      return cmp >= 0;
    case '<=':
      return cmp <= 0;
    default:
      return false;
  }
}

function evalExpr(expr: Expr, row: JoinedRow, sources: Source[], locale: Locale): boolean {
  if (expr.type === 'and') {
    return evalExpr(expr.left, row, sources, locale) && evalExpr(expr.right, row, sources, locale);
  }
  if (expr.type === 'or') {
    return evalExpr(expr.left, row, sources, locale) || evalExpr(expr.right, row, sources, locale);
  }

  const raw = valueAt(row, resolveRef(sources, expr.ref));

  if (expr.type === 'null') {
    const isNull = raw === null;
    return expr.negated ? !isNull : isNull;
  }
  if (expr.type === 'like') {
    if (raw === null) return false;
    const hit = likeToRegExp(expr.pattern).test(fold(cell(raw, locale)));
    return expr.negated ? !hit : hit;
  }
  return evalCmp(raw, expr.op, expr.value, locale);
}

/** Join key equality: NULL never matches, numbers compare numerically. */
function joinEqual(a: Value, b: Value, locale: Locale): boolean {
  if (a === null || b === null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return cell(a, locale) === cell(b, locale);
}

function sortRows(
  rows: JoinedRow[],
  at: Resolved,
  desc: boolean,
  locale: Locale
): JoinedRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const a = valueAt(x.row, at);
      const b = valueAt(y.row, at);
      // NULLs sort last, as psql does by default on ASC.
      if (a === null && b === null) return x.index - y.index;
      if (a === null) return 1;
      if (b === null) return -1;

      const na = typeof a === 'number' ? a : numeric(cell(a, locale));
      const nb = typeof b === 'number' ? b : numeric(cell(b, locale));
      const cmp =
        na !== null && nb !== null
          ? na - nb
          : cell(a, locale).localeCompare(cell(b, locale), locale, { sensitivity: 'accent' });

      if (cmp === 0) return x.index - y.index;
      return desc ? -cmp : cmp;
    })
    .map((entry) => entry.row);
}

function countNotice(n: number, locale: Locale): string {
  if (n === 0) return tr(locale, 'db.empty');
  return `${n} ${tr(locale, n === 1 ? 'db.row' : 'db.rows')}`;
}

interface Projection {
  label: string;
  at: Resolved;
}

function project(ast: SelectAst, sources: Source[]): Projection[] {
  const out: Projection[] = [];
  const push = (label: string, at: Resolved) => out.push({ label, at });

  for (const item of ast.items) {
    if (item.kind === 'count') continue;

    if (item.kind === 'star') {
      const chosen = item.qualifier
        ? [resolveStarSource(sources, item.qualifier)]
        : sources;
      for (const source of chosen) {
        for (const col of source.table.columns) {
          // With several tables in play, duplicate names get qualified so the
          // header stays readable — the same thing a DB GUI does.
          const duplicated =
            sources.length > 1 &&
            sources.filter((s) => columnOf(s.table, col.name)).length > 1;
          push(duplicated ? `${source.alias}.${col.name}` : col.name, {
            alias: source.alias,
            column: col.name,
          });
        }
      }
      continue;
    }

    const at = resolveRef(sources, item.ref);
    push(item.alias ?? item.ref.name, at);
  }
  return out;
}

function resolveStarSource(sources: Source[], qualifier: string): Source {
  const q = qualifier.toLowerCase();
  const source = sources.find(
    (s) => s.alias.toLowerCase() === q || s.table.name.toLowerCase() === q
  );
  if (!source) throw new SqlError('relation', qualifier);
  return source;
}

function runSelect(ast: SelectAst, locale: Locale): ResultTable {
  const sources: Source[] = [{ alias: ast.from.alias, table: resolveTable(ast.from.table) }];
  let rows: JoinedRow[] = sources[0].table.rows.map((row) => ({ [sources[0].alias]: row }));

  for (const join of ast.joins) {
    const table = resolveTable(join.table);
    if (sources.some((s) => s.alias.toLowerCase() === join.alias.toLowerCase())) {
      throw new SqlError('syntax', join.alias);
    }
    sources.push({ alias: join.alias, table });

    const pairs = join.on.map((c) => ({
      left: resolveRef(sources, c.left),
      right: resolveRef(sources, c.right),
    }));

    const next: JoinedRow[] = [];
    for (const row of rows) {
      let matched = false;
      for (const candidate of table.rows) {
        const trial: JoinedRow = { ...row, [join.alias]: candidate };
        if (pairs.every((p) => joinEqual(valueAt(trial, p.left), valueAt(trial, p.right), locale))) {
          next.push(trial);
          matched = true;
        }
      }
      if (!matched && join.outer) next.push({ ...row, [join.alias]: null });
    }
    rows = next;
  }

  const counting = ast.items.some((i) => i.kind === 'count');
  const picked = project(ast, sources);
  if (counting && picked.length > 0) {
    // COUNT(*) mixed with bare columns is aggregation we do not support.
    throw new SqlError('syntax', picked[0].label);
  }

  if (ast.where) rows = rows.filter((row) => evalExpr(ast.where!, row, sources, locale));

  if (ast.orderBy) {
    // SQL lets ORDER BY name an output alias; fall back to a real column.
    const { ref, desc } = ast.orderBy;
    const aliased = ref.qualifier
      ? undefined
      : picked.find((p) => p.label.toLowerCase() === ref.name.toLowerCase());
    rows = sortRows(rows, aliased ? aliased.at : resolveRef(sources, ref), desc, locale);
  }

  if (ast.limit !== undefined) rows = rows.slice(0, ast.limit);

  if (counting) {
    const item = ast.items.find((i) => i.kind === 'count') as { alias?: string };
    return {
      kind: 'table',
      columns: [item.alias ?? 'count'],
      rows: [[String(rows.length)]],
      notice: countNotice(1, locale),
    };
  }

  return {
    kind: 'table',
    columns: picked.map((p) => p.label),
    rows: rows.map((row) => picked.map((p) => cell(valueAt(row, p.at), locale))),
    notice: countNotice(rows.length, locale),
  };
}

/* ── Meta commands ──────────────────────────────────────────────── */

function listTables(locale: Locale): ResultTable {
  return {
    kind: 'table',
    columns: ['name', 'comment'],
    rows: schema.map((t) => [t.name, t.comment[locale]]),
    notice: countNotice(schema.length, locale),
  };
}

function describeTable(name: string, locale: Locale): ResultTable {
  const table = resolveTable(name);
  return {
    kind: 'table',
    columns: ['column', 'type', 'key', 'nullable'],
    rows: table.columns.map((c) => [
      c.name,
      c.type,
      [c.pk ? 'PK' : '', c.fk ? `FK → ${c.fk.table}.${c.fk.column}` : '']
        .filter(Boolean)
        .join(' '),
      c.nullable ? 'YES' : 'NO',
    ]),
    notice: countNotice(table.columns.length, locale),
  };
}

function helpText(locale: Locale): ResultNotice {
  return {
    kind: 'notice',
    lines: [
      { text: tr(locale, 'db.helpIntro') },
      {
        cmd: 'SELECT … FROM <table> [JOIN <table> ON …] [WHERE …] [ORDER BY …] [LIMIT n]',
        text: tr(locale, 'db.helpSelect'),
      },
      { cmd: '\\dt', text: tr(locale, 'db.helpTables') },
      { cmd: '\\d <table>', text: tr(locale, 'db.helpDescribe') },
      { cmd: 'clear', text: tr(locale, 'db.helpClear') },
      { cmd: '\\?', text: tr(locale, 'db.helpHelp') },
    ],
  };
}

function runMeta(input: string, locale: Locale): QueryResult {
  const body = input.replace(/;+$/, '').trim();
  const lower = body.toLowerCase();

  if (lower === '\\?' || lower === '?' || lower === 'help' || lower === '\\h') {
    return helpText(locale);
  }
  if (lower === 'clear' || lower === '\\clear') return { kind: 'clear' };
  if (lower === '\\dt' || lower === '\\dt+' || lower === '\\d') return listTables(locale);

  const described = /^\\d\+?\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(body);
  if (described) return describeTable(described[1], locale);

  throw new SqlError('syntax', body.split(/\s+/)[0]);
}

/* ── Public entry point ─────────────────────────────────────────── */

/** Table names, for tab completion in the console. */
export const completions: readonly string[] = tableNames;

export function runQuery(input: string, locale: Locale): QueryResult {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return { kind: 'notice', lines: [] };

  try {
    if (trimmed.startsWith('\\') || /^(clear|help|\?)\s*;?$/i.test(trimmed)) {
      return runMeta(trimmed, locale);
    }
    return runSelect(parseSelect(new Cursor(tokenize(trimmed), trimmed)), locale);
  } catch (err) {
    if (err instanceof SqlError) return { kind: 'error', message: messageFor(err, locale) };
    throw err;
  }
}
