/** In-memory expo-file-system (new API subset): folders, files and test-controlled pickers. */
const dirs = new Map<string, Map<string, string>>();

const filesOf = (dirUri: string) => {
  let d = dirs.get(dirUri);
  if (!d) dirs.set(dirUri, (d = new Map()));
  return d;
};
const split = (uri: string) => {
  const i = uri.lastIndexOf('/');
  return { dir: uri.slice(0, i), name: uri.slice(i + 1) };
};

export class File {
  readonly uri: string;
  constructor(...parts: (string | Directory)[]) {
    this.uri =
      parts.length === 2 ? `${typeof parts[0] === 'string' ? parts[0] : parts[0]!.uri}/${String(parts[1])}` : String(parts[0]);
  }
  get name() {
    return split(this.uri).name;
  }
  get exists() {
    const { dir, name } = split(this.uri);
    return filesOf(dir).has(name);
  }
  create() {
    const { dir, name } = split(this.uri);
    filesOf(dir).set(name, '');
  }
  write(content: string) {
    const { dir, name } = split(this.uri);
    filesOf(dir).set(name, content);
  }
  delete() {
    const { dir, name } = split(this.uri);
    filesOf(dir).delete(name);
  }
  async text() {
    const { dir, name } = split(this.uri);
    const content = filesOf(dir).get(name);
    if (content === undefined) throw new Error(`no such file ${this.uri}`);
    return content;
  }
  static nextPick: File | null = null;
  static async pickFileAsync(): Promise<File> {
    if (!File.nextPick) throw new Error('cancelled');
    return File.nextPick;
  }
}

export class Directory {
  constructor(readonly uri: string) {}
  list(): File[] {
    return [...filesOf(this.uri).keys()].map((name) => new File(this, name));
  }
  createFile(name: string): File {
    const f = new File(this, name);
    f.create();
    return f;
  }
  static nextPick: string | null = null;
  static async pickDirectoryAsync(): Promise<Directory> {
    if (!Directory.nextPick) throw new Error('cancelled');
    return new Directory(Directory.nextPick);
  }
}

export const Paths = {
  get cache() {
    return new Directory('file:///cache');
  },
  get document() {
    return new Directory('file:///documents');
  },
};

/** Test helper: wipe the fake file system. */
export const resetFileSystem = () => dirs.clear();
