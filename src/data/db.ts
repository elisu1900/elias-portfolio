/**
 * The portfolio as a properly normalised relational database.
 *
 * This is the single dataset behind the schema diagram and the SQL console.
 * It is deliberately in third normal form: lookup tables (skill_categories,
 * institutions, companies) and junction tables (project_skills,
 * service_skills) exist so that INNER JOIN queries are genuinely meaningful
 * rather than decorative.
 *
 * Every fact here is verified from Elías's CV. Nothing is invented and there
 * are no fabricated metrics.
 *
 * Prose values are localized as { en, es }; identifiers, URLs, dates and
 * numbers are language-neutral and stay plain.
 *
 * NOTE: his email address deliberately does not appear in this file. It must
 * never reach the rendered HTML, so contact_channels points at the form.
 */

export interface Localized {
  en: string;
  es: string;
}

export type Value = string | number | boolean | null | Localized | string[];

export interface Column {
  name: string;
  /** SQL-ish type, shown in the diagram and by \d */
  type: string;
  pk?: boolean;
  fk?: { table: string; column: string };
  nullable?: boolean;
}

export interface Table {
  name: string;
  comment: Localized;
  columns: Column[];
  rows: Record<string, Value>[];
}

export function isLocalized(v: Value): v is Localized {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'en' in v && 'es' in v;
}

/** Flattens a cell to a display string for the current locale. */
export function cell(v: Value, locale: 'en' | 'es'): string {
  if (v === null || v === undefined) return 'NULL';
  if (Array.isArray(v)) return v.join(', ');
  if (isLocalized(v)) return v[locale];
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export const schema: Table[] = [
  /* ── Core ──────────────────────────────────────────────────── */
  {
    name: 'developer',
    comment: {
      en: 'The one row this whole site is about',
      es: 'La única fila de la que trata esta web',
    },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'full_name', type: 'text' },
      { name: 'role', type: 'text' },
      { name: 'city', type: 'text' },
      { name: 'country', type: 'text' },
      { name: 'github', type: 'text' },
      { name: 'linkedin', type: 'text' },
    ],
    rows: [
      {
        id: 1,
        full_name: 'Elías Wassit Calzado',
        role: {
          en: 'AI Engineer · Full-stack Developer',
          es: 'Ingeniero de IA · Desarrollador full-stack',
        },
        city: 'Málaga',
        country: { en: 'Spain', es: 'España' },
        github: 'https://github.com/elisu1900',
        linkedin: 'https://www.linkedin.com/in/elias-wassit-calzado/',
      },
    ],
  },

  {
    name: 'companies',
    comment: { en: 'Organisations he has built software for', es: 'Organizaciones para las que ha desarrollado' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'name', type: 'text' },
      { name: 'sector', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'url', type: 'text', nullable: true },
    ],
    rows: [
      {
        id: 1,
        name: 'Vision Harbor Technologies',
        sector: { en: 'Port logistics software', es: 'Software de logística portuaria' },
        description: {
          en: 'Startup building software for port operations. Its platform, VisionOne, manages stevedoring personnel and shift planning at the Port of Málaga — the dock labour that moves every container through the port.',
          es: 'Startup que desarrolla software para operaciones portuarias. Su plataforma, VisionOne, gestiona el personal de estiba y la planificación de turnos en el Puerto de Málaga: la mano de obra que mueve cada contenedor del puerto.',
        },
        // The apex domain times out; www is the one that serves.
        url: 'https://visionharbor.ai',
      },
    ],
  },

  {
    name: 'experience',
    comment: { en: 'Where he has engineered software', es: 'Dónde ha desarrollado software' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'company_id', type: 'integer', fk: { table: 'companies', column: 'id' } },
      { name: 'position', type: 'text' },
      { name: 'started', type: 'date' },
      { name: 'ended', type: 'date', nullable: true },
      { name: 'summary', type: 'text' },
    ],
    rows: [
      {
        id: 1,
        developer_id: 1,
        company_id: 1,
        position: 'Software Engineer',
        started: '2026-03',
        ended: null,
        summary: {
          en: 'Full-stack engineering on a workforce platform for stevedoring operations at the Port of Málaga. Architecture analysis of the access and permissions model, AI integrated into the development cycle, and DevOps work across deployments and CI/CD.',
          es: 'Desarrollo full-stack de una plataforma de gestión de personal para las operaciones de estiba del Puerto de Málaga. Análisis de arquitectura del modelo de accesos y permisos, IA integrada en el ciclo de desarrollo y trabajo de DevOps en despliegues y CI/CD.',
        },
      },
    ],
  },

  {
    name: 'projects',
    comment: { en: 'Software in production', es: 'Software en producción' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'company_id', type: 'integer', fk: { table: 'companies', column: 'id' } },
      { name: 'name', type: 'text' },
      { name: 'client', type: 'text' },
      { name: 'summary', type: 'text' },
      { name: 'year', type: 'integer' },
      { name: 'status', type: 'text' },
      { name: 'url', type: 'text', nullable: true },
    ],
    rows: [
      {
        id: 1,
        company_id: 1,
        name: 'VisionOne',
        client: { en: 'Port of Málaga', es: 'Puerto de Málaga' },
        summary: {
          en: 'Workforce management platform for port personnel and stevedoring shifts — scheduling the dock labour that moves every container through the port.',
          es: 'Plataforma de gestión de personal portuario y turnos de estiba: organiza la mano de obra que mueve cada contenedor del puerto.',
        },
        year: 2026,
        status: 'live',
        url: 'https://visionone.visionharbor.ai',
      },
    ],
  },

  /* ── Skills, normalised ────────────────────────────────────── */
  {
    name: 'skill_categories',
    comment: { en: 'Lookup table for skill kinds', es: 'Tabla de consulta de tipos de habilidad' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'name', type: 'text' },
    ],
    rows: [
      { id: 1, name: { en: 'language', es: 'lenguaje' } },
      { id: 2, name: { en: 'framework', es: 'framework' } },
      { id: 3, name: { en: 'infrastructure', es: 'infraestructura' } },
      { id: 4, name: { en: 'ai', es: 'ia' } },
      { id: 5, name: { en: 'tooling', es: 'herramientas' } },
      { id: 6, name: { en: 'data', es: 'datos' } },
    ],
  },

  {
    name: 'skills',
    comment: { en: 'What he works with', es: 'Con qué trabaja' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'name', type: 'text' },
      { name: 'category_id', type: 'integer', fk: { table: 'skill_categories', column: 'id' } },
    ],
    rows: [
      { id: 1, name: 'C#', category_id: 1 },
      { id: 2, name: 'TypeScript', category_id: 1 },
      { id: 3, name: 'SQL', category_id: 1 },
      { id: 4, name: '.NET', category_id: 2 },
      { id: 5, name: 'React', category_id: 2 },
      { id: 6, name: 'Docker', category_id: 3 },
      { id: 7, name: 'Linux', category_id: 3 },
      { id: 8, name: 'CI/CD', category_id: 3 },
      { id: 9, name: 'Claude Code', category_id: 4 },
      { id: 10, name: 'Git', category_id: 5 },
      { id: 11, name: 'Power BI', category_id: 6 },
    ],
  },

  {
    name: 'project_skills',
    comment: {
      en: 'Junction table: which technologies each project used',
      es: 'Tabla de unión: qué tecnologías usó cada proyecto',
    },
    columns: [
      { name: 'project_id', type: 'integer', pk: true, fk: { table: 'projects', column: 'id' } },
      { name: 'skill_id', type: 'integer', pk: true, fk: { table: 'skills', column: 'id' } },
    ],
    rows: [
      { project_id: 1, skill_id: 1 },
      { project_id: 1, skill_id: 3 },
      { project_id: 1, skill_id: 4 },
      { project_id: 1, skill_id: 5 },
      { project_id: 1, skill_id: 8 },
      { project_id: 1, skill_id: 9 },
      { project_id: 1, skill_id: 10 },
    ],
  },

  /* ── Background ────────────────────────────────────────────── */
  {
    name: 'institutions',
    comment: { en: 'Lookup table for schools', es: 'Tabla de consulta de centros' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'name', type: 'text' },
      { name: 'city', type: 'text' },
    ],
    rows: [
      { id: 1, name: 'IES Pablo Picasso', city: 'Málaga' },
      { id: 2, name: 'IES Miraflores de los Ángeles', city: 'Málaga' },
    ],
  },

  {
    name: 'education',
    comment: { en: 'Formal training', es: 'Formación oficial' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'institution_id', type: 'integer', fk: { table: 'institutions', column: 'id' } },
      { name: 'title', type: 'text' },
      { name: 'started', type: 'integer' },
      { name: 'ended', type: 'integer' },
    ],
    rows: [
      {
        id: 1,
        developer_id: 1,
        institution_id: 1,
        title: {
          en: 'Higher Diploma in Multiplatform Application Development',
          es: 'Grado Superior en Desarrollo de Aplicaciones Multiplataforma',
        },
        started: 2024,
        ended: 2026,
      },
      {
        id: 2,
        developer_id: 1,
        institution_id: 2,
        title: { en: 'Technological Baccalaureate', es: 'Bachillerato tecnológico' },
        started: 2022,
        ended: 2024,
      },
    ],
  },

  {
    name: 'certifications',
    comment: { en: 'Courses and certificates', es: 'Cursos y certificados' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'name', type: 'text' },
      { name: 'issuer', type: 'text' },
      { name: 'hours', type: 'integer', nullable: true },
    ],
    rows: [
      { id: 1, developer_id: 1, name: 'Power BI', issuer: 'Udemy', hours: null },
      { id: 2, developer_id: 1, name: 'Linux Basics', issuer: 'Cisco', hours: null },
      {
        id: 3,
        developer_id: 1,
        name: {
          en: 'Occupational risk prevention',
          es: 'Prevención de riesgos laborales',
        },
        issuer: { en: 'Accredited training centre', es: 'Centro docente acreditado' },
        hours: 30,
      },
    ],
  },

  {
    name: 'spoken_languages',
    comment: { en: 'Languages he works in', es: 'Idiomas en los que trabaja' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'language', type: 'text' },
      { name: 'level', type: 'text' },
      { name: 'certified_by', type: 'text', nullable: true },
    ],
    rows: [
      {
        id: 1,
        developer_id: 1,
        language: { en: 'Spanish', es: 'Español' },
        level: { en: 'native', es: 'nativo' },
        certified_by: null,
      },
      {
        id: 2,
        developer_id: 1,
        language: { en: 'English', es: 'Inglés' },
        level: 'B1',
        certified_by: 'Cambridge',
      },
    ],
  },

  {
    name: 'contact_channels',
    comment: { en: 'How to reach him', es: 'Cómo contactarle' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'channel', type: 'text' },
      { name: 'handle', type: 'text' },
      { name: 'preferred', type: 'boolean' },
    ],
    rows: [
      {
        id: 1,
        developer_id: 1,
        channel: 'email',
        // Deliberately not the literal address: it must never be scrapeable.
        handle: { en: 'via the contact form', es: 'vía el formulario de contacto' },
        preferred: true,
      },
      { id: 2, developer_id: 1, channel: 'github', handle: 'github.com/elisu1900', preferred: false },
      {
        id: 3,
        developer_id: 1,
        channel: 'linkedin',
        handle: 'elias-wassit-calzado',
        preferred: false,
      },
    ],
  },

  {
    name: 'documents',
    comment: { en: 'Downloadable documents', es: 'Documentos descargables' },
    columns: [
      { name: 'id', type: 'serial', pk: true },
      { name: 'developer_id', type: 'integer', fk: { table: 'developer', column: 'id' } },
      { name: 'kind', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'format', type: 'text' },
      { name: 'url', type: 'text' },
    ],
    rows: [
      {
        id: 1,
        developer_id: 1,
        kind: 'cv',
        title: { en: 'Curriculum vitae', es: 'Currículum' },
        format: 'pdf',
        // The file must be placed at public/cv/ before this resolves.
        url: '/cv/elias-wassit-calzado.pdf',
      },
    ],
  },
];

export const tableNames = schema.map((t) => t.name);

export function getTable(name: string): Table | undefined {
  return schema.find((t) => t.name === name.toLowerCase());
}

/** Foreign-key edges, for drawing the ER diagram. */
export const relations = schema.flatMap((t) =>
  t.columns
    .filter((c) => c.fk)
    .map((c) => ({
      from: { table: t.name, column: c.name },
      to: { table: c.fk!.table, column: c.fk!.column },
    }))
);
