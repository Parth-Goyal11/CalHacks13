import type { SkyPhotoResult } from "./analysis";
import {
  creaturesFrom,
  tierRank,
  type StoredCreature,
} from "./collection";

export type { StoredCreature };

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
const CREATURES = "creatures";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CREATURES)) {
        db.createObjectStore(CREATURES, { keyPath: "id" });
      }
    };
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

export async function readCreatures(): Promise<StoredCreature[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(CREATURES, "readonly");
      const request = transaction.objectStore(CREATURES).getAll();
      transaction.oncomplete = () =>
        resolve(
          (request.result as StoredCreature[]).sort(
            (a, b) => tierRank(b.tier) - tierRank(a.tier) || a.name.localeCompare(b.name),
          ),
        );
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Reading the collection was interrupted."));
    });
  } finally {
    db.close();
  }
}

export async function readCreature(id: string): Promise<StoredCreature | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(CREATURES, "readonly");
      const request = transaction.objectStore(CREATURES).get(id);
      transaction.oncomplete = () => resolve((request.result as StoredCreature) ?? null);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Reading the creature was interrupted."));
    });
  } finally {
    db.close();
  }
}

async function updateCreature(
  id: string,
  update: (existing: StoredCreature | null) => StoredCreature | null,
): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CREATURES, "readwrite");
      const store = transaction.objectStore(CREATURES);
      const request = store.get(id);
      request.onsuccess = () => {
        const next = update((request.result as StoredCreature | undefined) ?? null);
        if (next) store.put(next);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving the creature was interrupted."));
    });
  } finally {
    db.close();
  }
}

export async function saveCreatureImage(draft: StoredCreature, image: Blob): Promise<void> {
  await updateCreature(draft.id, (existing) => {
    if (existing && tierRank(draft.tier) < tierRank(existing.tier)) return null;
    return { ...existing, ...draft, image };
  });
}

export async function collectOne(creature: StoredCreature): Promise<StoredCreature[]> {
  await updateCreature(creature.id, (previous) =>
    !previous || tierRank(creature.tier) > tierRank(previous.tier)
      ? { ...creature, image: undefined, caughtAt: new Date().toISOString() }
      : null,
  );
  return readCreatures();
}

export async function collectCreatures(result: SkyPhotoResult): Promise<StoredCreature[]> {
  const incoming = creaturesFrom(result);
  if (!incoming.length) return readCreatures();
  for (const creature of incoming) {
    await updateCreature(creature.id, (previous) =>
      !previous || tierRank(creature.tier) > tierRank(previous.tier)
        ? { ...creature, image: undefined, caughtAt: new Date().toISOString() }
        : null,
    );
  }
  return readCreatures();
}
