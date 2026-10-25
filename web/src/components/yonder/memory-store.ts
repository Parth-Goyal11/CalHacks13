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

async function writeCreature(creature: StoredCreature): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CREATURES, "readwrite");
      transaction.objectStore(CREATURES).put(creature);
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
  const existing = await readCreature(draft.id);
  const base = existing ?? draft;
  const next =
    tierRank(draft.tier) >= tierRank(base.tier)
      ? { ...base, ...draft, image }
      : { ...base, image: base.image ?? image };
  await writeCreature(next);
}

export async function collectOne(creature: StoredCreature): Promise<StoredCreature[]> {
  const current = await readCreatures();
  const byId = new Map(current.map((item) => [item.id, item]));
  const previous = byId.get(creature.id);
  if (!previous || tierRank(creature.tier) > tierRank(previous.tier)) {
    const next = {
      ...creature,
      image: previous?.image,
      caughtAt: new Date().toISOString(),
    };
    byId.set(creature.id, next);
    await writeCreature(next);
  }
  return [...byId.values()].sort(
    (a, b) => tierRank(b.tier) - tierRank(a.tier) || a.name.localeCompare(b.name),
  );
}

export async function collectCreatures(result: SkyPhotoResult): Promise<StoredCreature[]> {
  const incoming = creaturesFrom(result);
  if (!incoming.length) return readCreatures();
  const current = await readCreatures();
  const byId = new Map(current.map((creature) => [creature.id, creature]));
  for (const creature of incoming) {
    const previous = byId.get(creature.id);
    if (!previous || tierRank(creature.tier) > tierRank(previous.tier)) {
      const next = {
        ...creature,
        image: previous?.image,
        caughtAt: new Date().toISOString(),
      };
      byId.set(creature.id, next);
      await writeCreature(next);
    }
  }
  return [...byId.values()].sort(
    (a, b) => tierRank(b.tier) - tierRank(a.tier) || a.name.localeCompare(b.name),
  );
}
