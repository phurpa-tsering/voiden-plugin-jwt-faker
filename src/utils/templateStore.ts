import type { PluginFS } from '@voiden/sdk/ui';
import type { JwtTemplate } from './types';

/**
 * Templates are saved per project. Voiden's .gitignore ignores `.voiden/*`,
 * so this file stays local and signing secrets are never committed.
 */
export const TEMPLATES_DIR = '.voiden';
export const TEMPLATES_FILE = `${TEMPLATES_DIR}/jwt-templates.json`;

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

  // Run saves one at a time, so two quick saves can't both try to create .voiden.
  let pending: Promise<void> = Promise.resolve();
  const save = (templates: JwtTemplate[]) => {
    const next = pending.catch(() => {}).then(() => writeTemplates(templates));
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
