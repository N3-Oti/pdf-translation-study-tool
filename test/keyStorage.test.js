import test from "node:test";
import assert from "node:assert/strict";
import { loadDeviceSavedKey, persistGeminiKey } from "../src/lib/keyStorage.js";

test("does not save the Gemini Key unless the user opts in", () => {
  const storage = new MapStorage();

  persistGeminiKey(storage, "abc123", false);

  assert.equal(loadDeviceSavedKey(storage), "");
});

test("saves and clears the Gemini Key on the current device", () => {
  const storage = new MapStorage();

  persistGeminiKey(storage, "abc123", true);
  assert.equal(loadDeviceSavedKey(storage), "abc123");

  persistGeminiKey(storage, "", false);
  assert.equal(loadDeviceSavedKey(storage), "");
});

class MapStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}
