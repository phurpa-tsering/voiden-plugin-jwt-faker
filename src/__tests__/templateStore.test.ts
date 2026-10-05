import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTemplateStore, LEGACY_STORAGE_KEY, TEMPLATES_FILE } from '../utils/templateStore';
import type { JwtTemplate } from '../utils/types';

const template = (id: string, name: string): JwtTemplate => ({
  id,
  name,
  algorithm: 'HS256',
  secret: 'secret',
  header: '{"alg":"HS256","typ":"JWT"}',
  payload: '{"sub":"1"}',
});

/**
 * In-memory stand-in for context.fs, keyed by project-relative path. Mirrors
 * Voiden: reading a missing file returns null, and writing into a missing
 * directory fails.
 */
const createFakeFs = (files: Record<string, string> = {}, dirs: string[] = ['.voiden']) => {
  const directories = new Set(dirs);
  return {
    files,
    directories,
    read: async (path: string) => (path in files ? files[path] : (null as unknown as string)),
    write: async (path: string, content: string) => {
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (dir && !directories.has(dir)) throw new Error(`ENOENT: no such directory ${dir}`);
      files[path] = content;
    },
    list: async () => [...directories].map((name) => ({ name, path: name, type: 'directory' as const })),
    createDirectory: async (path: string) => {
      directories.add(path);
    },
  };
};

const createFakeLocalStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

describe('templateStore', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = createFakeLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
  });

  it('returns an empty list when the project has no templates file', async () => {
    const fs = createFakeFs();
    expect(await createTemplateStore(fs).load()).toEqual([]);
    expect(fs.files[TEMPLATES_FILE]).toBeUndefined();
  });

  it('saves to .voiden/jwt-templates.json', async () => {
    const fs = createFakeFs();
    await createTemplateStore(fs).save([template('1', 'Admin')]);

    expect(JSON.parse(fs.files[TEMPLATES_FILE])).toEqual({ version: 1, templates: [template('1', 'Admin')] });
  });

  it('creates .voiden when the project does not have it yet', async () => {
    const fs = createFakeFs({}, []);
    await createTemplateStore(fs).save([template('1', 'Admin')]);

    expect(fs.directories.has('.voiden')).toBe(true);
    expect(JSON.parse(fs.files[TEMPLATES_FILE]).templates).toHaveLength(1);
  });

  it('does not create .voiden again when a write fails for another reason', async () => {
    const fs = createFakeFs();
    let createCalls = 0;
    fs.createDirectory = async () => void createCalls++;
    fs.write = async () => {
      throw new Error('EACCES');
    };

    await expect(createTemplateStore(fs).save([template('1', 'Admin')])).rejects.toThrow('EACCES');
    expect(createCalls).toBe(0);
  });

  it('creates .voiden only once when two saves run at the same time', async () => {
    const fs = createFakeFs({}, []);
    let createCalls = 0;
    const createDirectory = fs.createDirectory;
    fs.createDirectory = async (path: string) => {
      createCalls++;
      await createDirectory(path);
    };
    const store = createTemplateStore(fs);

    await Promise.all([store.save([template('1', 'A')]), store.save([template('2', 'B')])]);

    expect(createCalls).toBe(1);
    expect(JSON.parse(fs.files[TEMPLATES_FILE]).templates.map((t: JwtTemplate) => t.name)).toEqual(['B']);
  });

  it('loads templates saved earlier', async () => {
    const fs = createFakeFs();
    const store = createTemplateStore(fs);
    await store.save([template('1', 'Admin'), template('2', 'User')]);

    expect((await store.load()).map((t) => t.name)).toEqual(['Admin', 'User']);
  });

  it('imports legacy localStorage templates once, then removes them', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([template('1', 'Legacy')]));
    const fs = createFakeFs();

    expect((await createTemplateStore(fs).load()).map((t) => t.name)).toEqual(['Legacy']);
    expect(JSON.parse(fs.files[TEMPLATES_FILE]).templates).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it('prefers an existing project file over legacy localStorage templates', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([template('1', 'Legacy')]));
    const fs = createFakeFs({ [TEMPLATES_FILE]: JSON.stringify({ version: 1, templates: [template('2', 'Project')] }) });

    expect((await createTemplateStore(fs).load()).map((t) => t.name)).toEqual(['Project']);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull();
  });

  it('throws on a malformed file instead of treating it as empty', async () => {
    const fs = createFakeFs({ [TEMPLATES_FILE]: '{ not json' });
    await expect(createTemplateStore(fs).load()).rejects.toThrow();

    const noList = createFakeFs({ [TEMPLATES_FILE]: '{"version":1}' });
    await expect(createTemplateStore(noList).load()).rejects.toThrow('no "templates" list');
  });
});
