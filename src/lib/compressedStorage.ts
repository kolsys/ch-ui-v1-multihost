import { compressToUTF16, decompressFromUTF16 } from "lz-string";
import type { StateStorage } from "zustand/middleware";

// Marks a value as lz-string-compressed so old, plain-JSON values already in
// localStorage keep working — read either way, but always written compressed
// from here on. No separate migration step needed.
const COMPRESSED_PREFIX = "lz:";

/**
 * Reads a localStorage value written by `compressedLocalStorage`, transparently
 * decompressing it if it carries the compressed-format prefix. Used anywhere
 * that needs to read the persisted store outside of zustand itself (e.g. the
 * Monaco editor's schema cache, which reads "app-storage" directly).
 */
export function readCompressedLocalStorageItem(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  if (raw.startsWith(COMPRESSED_PREFIX)) {
    return decompressFromUTF16(raw.slice(COMPRESSED_PREFIX.length));
  }
  return raw;
}

/**
 * Drop-in zustand `StateStorage` that compresses values on write (large
 * persisted strings like saved SQL tabs were pushing localStorage toward its
 * quota) while still reading old, uncompressed entries written before this
 * was added.
 */
export const compressedLocalStorage: StateStorage = {
  getItem: (name) => readCompressedLocalStorageItem(name),
  setItem: (name, value) => {
    localStorage.setItem(name, COMPRESSED_PREFIX + compressToUTF16(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};
