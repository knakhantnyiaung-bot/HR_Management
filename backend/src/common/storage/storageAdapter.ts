import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

// Sprint 2 HLD Sec 4.1/13.3 — file references (receipts, resumes) store a
// storage key + metadata in Postgres; the binary never lives in the
// database. This interface is the seam: Sprint 2 ships a local-disk
// implementation (see the plan's infra deviation note — no S3/object
// storage credentials exist in this repo yet), and a real S3-compatible
// adapter can implement the same three methods later without any caller
// (expenses, recruitment) changing.
export interface StorageAdapter {
  save(buffer: Buffer, extension: string): Promise<string>;
  readStream(storageKey: string): Readable;
  delete(storageKey: string): Promise<void>;
}

// Files live outside the repo tree it's checked out into via an absolute
// path relative to the backend package root, gitignored (see
// backend/.gitignore) — never served directly by Express static; every read
// goes through an authenticated, ownership-checked download route (expenses/
// recruitment routes), the same access-control property a signed S3 URL
// would give.
const STORAGE_ROOT = path.resolve(__dirname, "../../../storage");

function keyToPath(storageKey: string): string {
  // storageKey is always a value this adapter generated (uuid.ext) — never
  // derived from user input — so there's no path-traversal surface here.
  return path.join(STORAGE_ROOT, storageKey);
}

class LocalDiskStorageAdapter implements StorageAdapter {
  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(STORAGE_ROOT, { recursive: true });
    const storageKey = `${randomUUID()}${extension}`;
    await writeFile(keyToPath(storageKey), buffer);
    return storageKey;
  }

  readStream(storageKey: string): Readable {
    return createReadStream(keyToPath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(keyToPath(storageKey), { force: true });
  }
}

export const storageAdapter: StorageAdapter = new LocalDiskStorageAdapter();

export async function storageFileExists(storageKey: string): Promise<boolean> {
  try {
    await stat(keyToPath(storageKey));
    return true;
  } catch {
    return false;
  }
}
