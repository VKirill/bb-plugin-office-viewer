// Office Viewer — downloads a file from its preview link, keeping a copy in
// IndexedDB. BB's preview route tags each file with an ETag built from its
// inode, size and change times. The next open sends that tag back; an
// unchanged file answers 304 with no body and the stored copy is used, so
// reopening a document does not move it over the network again.

const DB_NAME = "office-viewer-file-cache";
/** Small records (key, etag, size, usedAt), so touching and evicting never rewrite file bytes. */
const META = "meta";
/** File bytes by the same key, written only after a download. */
const BLOBS = "blobs";
/** Larger files are not stored. */
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
/** The least recently opened files are dropped above this total. */
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
/** Files not opened for this long are dropped. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** A storage call slower than this counts as a miss, so a stuck IndexedDB cannot hold up opening a file. */
const TIMEOUT_MS = 2000;

type Meta = { key: string; etag: string; size: number; usedAt: number };

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Array.from(db.objectStoreNames)) db.deleteObjectStore(name);
      db.createObjectStore(META, { keyPath: "key" }).createIndex("usedAt", "usedAt");
      db.createObjectStore(BLOBS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("File cache upgrade blocked by another tab"));
  });
  database.catch(() => { database = null; });
  return database;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function timed<T>(work: Promise<T>): Promise<T> {
  return Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("File cache timed out")), TIMEOUT_MS))]);
}

async function readMeta(key: string): Promise<Meta | undefined> {
  const db = await open();
  return done<Meta | undefined>(db.transaction(META).objectStore(META).get(key));
}

async function readBlob(key: string): Promise<Blob | undefined> {
  const db = await open();
  return done<Blob | undefined>(db.transaction(BLOBS).objectStore(BLOBS).get(key));
}

async function touch(meta: Meta): Promise<void> {
  const db = await open();
  const transaction = db.transaction(META, "readwrite");
  transaction.objectStore(META).put({ ...meta, usedAt: Date.now() });
  await committed(transaction);
}

async function remove(key: string): Promise<void> {
  const db = await open();
  const transaction = db.transaction([META, BLOBS], "readwrite");
  transaction.objectStore(META).delete(key);
  transaction.objectStore(BLOBS).delete(key);
  await committed(transaction);
}

async function store(meta: Meta, blob: Blob): Promise<void> {
  const db = await open();
  const transaction = db.transaction([META, BLOBS], "readwrite");
  const metas = transaction.objectStore(META);
  const blobs = transaction.objectStore(BLOBS);
  metas.put(meta);
  blobs.put(blob, meta.key);
  // Newest first: keep files until the total passes the limit or they are too old, drop the rest.
  let total = 0;
  const cursor = metas.index("usedAt").openCursor(null, "prev");
  cursor.onsuccess = () => {
    const at = cursor.result;
    if (!at) return;
    const entry = at.value as Meta;
    total += entry.size;
    if (total > MAX_TOTAL_BYTES || entry.usedAt < meta.usedAt - MAX_AGE_MS) {
      at.delete();
      blobs.delete(entry.key);
    }
    at.continue();
  };
  await committed(transaction);
}

/**
 * Fetches a preview link like `fetch`, answering from the stored copy when the
 * file has not changed since it was stored under `key` (host and path).
 */
export async function fetchCached(url: string, key: string, useStored = true): Promise<Response> {
  const meta = useStored ? await timed(readMeta(key)).catch(() => undefined) : undefined;
  const response = await fetch(url, { cache: "no-store", headers: meta ? { "If-None-Match": meta.etag } : {} });
  if (response.status === 304 && meta) {
    // A stored copy can become unreadable (lost or corrupted browser storage): drop it and download again.
    const bytes = await timed(readBlob(key))
      .then((blob) => blob?.arrayBuffer())
      .catch(() => undefined);
    if (bytes) {
      void touch(meta).catch(() => undefined);
      return new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
    }
    await timed(remove(key)).catch(() => undefined);
    return fetchCached(url, key, false);
  }
  const etag = response.headers.get("etag");
  if (!response.ok) return response;
  const blob = await response.blob();
  const keep = etag && blob.size <= MAX_ENTRY_BYTES;
  void (keep ? store({ key, etag, size: blob.size, usedAt: Date.now() }, blob) : meta ? remove(key) : Promise.resolve()).catch(() => undefined);
  return new Response(blob, { status: response.status, headers: response.headers });
}
