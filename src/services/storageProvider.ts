import { DemoStoreState } from '../domain/types';
import { IStorageProvider } from './interfaces';

const STORAGE_KEY = 'tok_aswan_demo_state_v1';

class LocalDemoStorageProvider implements IStorageProvider {
  loadState(): DemoStoreState | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DemoStoreState;
    } catch {
      return null;
    }
  }

  saveState(state: DemoStoreState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors in demo mode
    }
  }

  clearState(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export const storageProvider: IStorageProvider = new LocalDemoStorageProvider();
