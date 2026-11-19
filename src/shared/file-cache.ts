// Office Viewer — downloads a file from its preview link, keeping a copy in
// IndexedDB. BB's preview route tags each file with an ETag built from its
// inode, size and change times. The next open sends that tag back; an
// unchanged file answers 304 with no body and the stored copy is used, so
// reopening a document does not move it over the network again.

const DB_NAME = "office-viewer-file-cache";
const STORE = "files";
/** Larger files are not stored. */
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
/** The least recently opened files are dropped above this total. */
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

type Entry = { key: string; etag: string; blob: Blob; size: number; usedAt: number };

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("usedAt", "usedAt");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

async function read(key: string): Promise<Entry | undefined> {
  const db = await open();
  return done<Entry | undefined>(db.transaction(STORE).objectStore(STORE).get(key));
}

async function write(entry: Entry): Promise<void> {
  const db = await open();
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  await done(store.put(entry));
  // Newest first: keep files until the total passes the limit, drop the rest.
  let total = 0;
  const cursor = store.index("usedAt").openCursor(null, "prev");
  await new Promise<void>((resolve, reject) => {
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      const at = cursor.result;
      if (!at) return resolve();
      total += (at.value as Entry).size;
      if (total > MAX_TOTAL_BYTES) at.delete();
      at.continue();
    };
  });
}

/**
 * Fetches a preview link like `fetch`, answering from the stored copy when the
 * file has not changed since it was stored under `key` (host and path).
 */
export async function fetchCached(url: string, key: string): Promise<Response> {
  const stored = await read(key).catch(() => undefined);
  const response = await fetch(url, { cache: "no-store", headers: stored ? { "If-None-Match": stored.etag } : {} });
  if (response.status === 304 && stored) {
    void write({ ...stored, usedAt: Date.now() }).catch(() => undefined);
    return new Response(stored.blob, { status: 200, headers: { "content-length": String(stored.size) } });
  }
  const etag = response.headers.get("etag");
  if (!response.ok || !etag) return response;
  const blob = await response.blob();
  if (blob.size <= MAX_ENTRY_BYTES) void write({ key, etag, blob, size: blob.size, usedAt: Date.now() }).catch(() => undefined);
  return new Response(blob, { status: response.status, headers: response.headers });
}
