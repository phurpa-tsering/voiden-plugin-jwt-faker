import type { PluginFS } from '@voiden/sdk/ui';
import type { JwtTemplate } from './types';

/**
 * Templates are saved per project and contain signing secrets, so the store
 * also keeps them out of git with its own `.voiden/.gitignore` entry rather
 * than relying on the project's root .gitignore.
 */
export const TEMPLATES_DIR = '.voiden';
export const TEMPLATES_FILE_NAME = 'jwt-templates.json';
export const TEMPLATES_FILE = `${TEMPLATES_DIR}/${TEMPLATES_FILE_NAME}`;
export const GITIGNORE_FILE = `${TEMPLATES_DIR}/.gitignore`;
const GITIGNORE_ENTRY = `# Added by the JWT Faker plugin: templates contain signing secrets.\n${TEMPLATES_FILE_NAME}\n`;

/** Where versions before 1.1.0 kept templates (shared by every project). */
export const LEGACY_STORAGE_KEY = '__voiden_jwt_templates__';

// Only read/write/list/createDirectory are used: context.fs.exists() currently
// always reports files as missing, so existence is inferred from read() instead.
type ProjectFs = Pick<PluginFS, 'read' | 'write' | 'list' | 'createDirectory'>;

export interface TemplateStore {
  /** Read this project's templates, importing legacy localStorage templates once. */
  load: () => Promise<JwtTemplate[]>;
  /** Replace this project's templates. */
  save: (templates: JwtTemplate[]) => Promise<void>;
}

const readLegacyTemplates = (): JwtTemplate[] => {
  try {
    const saved = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const clearLegacyTemplates = () => {
  try {
    globalThis.localStorage?.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const createTemplateStore = (fs: ProjectFs): TemplateStore => {
  const writeTemplates = async (templates: JwtTemplate[]) => {
    const content = `${JSON.stringify({ version: 1, templates }, null, 2)}\n`;
    try {
      await fs.write(TEMPLATES_FILE, content);
    } catch (err) {
      // Most likely the project has no .voiden folder yet: create it once and retry.
      const entries = await fs.list();
      if (entries.some((entry) => entry.name === TEMPLATES_DIR)) throw err;
      await fs.createDirectory(TEMPLATES_DIR);
      await fs.write(TEMPLATES_FILE, content);
    }
  };

  // Add the templates file to .voiden/.gitignore, keeping any existing entries.
  const ensureGitignored = async () => {
    const existing = (await fs.read(GITIGNORE_FILE)) ?? '';
    const lines = existing.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(TEMPLATES_FILE_NAME) || lines.includes(`/${TEMPLATES_FILE_NAME}`)) return;
    const separator = existing && !existing.endsWith('\n') ? '\n' : '';
    await fs.write(GITIGNORE_FILE, `${existing}${separator}${GITIGNORE_ENTRY}`);
  };

  // Run saves one at a time, so two quick saves can't both try to create .voiden.
  let pending: Promise<void> = Promise.resolve();
  const save = (templates: JwtTemplate[]) => {
    const next = pending
      .catch(() => {})
      .then(async () => {
        await writeTemplates(templates);
        await ensureGitignored();
      });
    pending = next;
    return next;
  };

  const load = async () => {
    const raw = await fs.read(TEMPLATES_FILE);
    if (raw != null && raw.trim() !== '') {
      // Throws on a malformed file so the caller never overwrites it.
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.templates)) {
        throw new Error(`${TEMPLATES_FILE} has no "templates" list`);
      }
      // Also covers files saved before the .gitignore entry existed.
      await ensureGitignored().catch(() => {});
      return parsed.templates as JwtTemplate[];
    }

    const legacy = readLegacyTemplates();
    if (legacy.length > 0) {
      await save(legacy);
      clearLegacyTemplates();
    }
    return legacy;
  };

  return { load, save };
};
