import AsyncStorage from '@react-native-async-storage/async-storage';

// Сховище на час вкладки: у режимі-імітації кожна вкладка = окремий «пристрій» зі своїм сеансом
const mem = new Map<string, string>();

function ses(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export const sessionKv = {
  get(k: string): string | null {
    const s = ses();
    return s ? s.getItem(k) : mem.get(k) ?? null;
  },
  set(k: string, v: string) {
    const s = ses();
    if (s) s.setItem(k, v);
    else mem.set(k, v);
  },
  del(k: string) {
    const s = ses();
    if (s) s.removeItem(k);
    else mem.delete(k);
  },
};

// Постійне сховище пристрою (мітки синхронізації)
export const localKv = {
  get: (k: string) => AsyncStorage.getItem(k),
  set: (k: string, v: string) => AsyncStorage.setItem(k, v),
  del: (k: string) => AsyncStorage.removeItem(k),
};
