const databaseName = 'prodesk-browser-login';
const storeName = 'device';
const currentKey = 'current';

export type BrowserDevice = { id: string; privateKey: CryptoKey };
export const deviceLogoutKey = 'prodesk:browser-device-logout';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Browser device storage is blocked'));
  });
}

async function accessDevice<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readBrowserDevice(): Promise<BrowserDevice | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  return await accessDevice('readonly', store => store.get(currentKey));
}

export async function saveBrowserDevice(device: BrowserDevice) {
  await accessDevice('readwrite', store => store.put(device, currentKey));
}

export async function removeBrowserDevice(id: string) {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.get(currentKey);
      request.onsuccess = () => {
        if (request.result?.id === id) store.delete(currentKey);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
