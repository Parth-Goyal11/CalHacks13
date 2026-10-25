import type { SkyPhotoResult } from "./analysis";

export type StoredMemory = {
  id: string;
  image: Blob;
  title: string;
  createdAt: string;
  location: string;
  result: SkyPhotoResult;
  note: string;
};

const DATABASE = "yonder-local";
const STORE = "memories";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close another Yonder tab and try again."));
  });
}

export async function readMemories(): Promise<StoredMemory[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).getAll();
      transaction.oncomplete = () =>
        resolve(
          (request.result as StoredMemory[]).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        );
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("Reading memories was interrupted."),
        );
    });
  } finally {
    db.close();
  }
}

export async function writeMemory(memory: StoredMemory): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(memory);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving was interrupted."));
    });
  } finally {
    db.close();
  }
}

export async function removeMemory(id: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Removing the memory was interrupted."),
        );
    });
  } finally {
    db.close();
  }
}
