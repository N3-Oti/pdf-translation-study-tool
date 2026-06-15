const KEY = "pdf-translation-study-tool.gemini-key";

export function loadDeviceSavedKey(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function persistGeminiKey(storage = globalThis.localStorage, key, shouldSave) {
  if (!storage) {
    return;
  }

  try {
    if (shouldSave && key) {
      storage.setItem(KEY, key);
      return;
    }

    storage.removeItem(KEY);
  } catch {
    // Browsers can deny storage in private modes. The app should continue with in-memory use.
  }
}
