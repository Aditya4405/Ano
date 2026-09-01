import { preloadDerbyVehicleGLB } from '@/components/games/demolition-derby/Derby3DVehicleBuilder';
import { VehicleId } from '@/components/games/demolition-derby/types';

export const DERBY_ASSETS: Record<string, string> = {
  road_crusher: '/models/derby/road_crusher.glb',
  iron_tanker: '/models/derby/iron_tanker.glb',
  apex_phantom: '/models/derby/apex_phantom.glb',
  armored_juggernaut: '/models/derby/armored_juggernaut.glb',
};

export interface DerbyPreloadState {
  total: number;
  loaded: number;
  failed: number;
  progress: number;
  isReady: boolean;
  isError: boolean;
  failedAssets: string[];
}

type Listener = (state: DerbyPreloadState) => void;

class DerbyAssetPreloader {
  private state: DerbyPreloadState = {
    total: Object.keys(DERBY_ASSETS).length,
    loaded: 0,
    failed: 0,
    progress: 0,
    isReady: false,
    isError: false,
    failedAssets: [],
  };

  private listeners: Set<Listener> = new Set();
  private isPreloadingStarted = false;

  public getState(): DerbyPreloadState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((l) => l(currentState));
  }

  public async startPreload() {
    if (typeof window === 'undefined') return;

    if (this.state.isReady) {
      this.notify();
      return;
    }

    if (this.isPreloadingStarted && !this.state.isError) {
      return;
    }

    this.isPreloadingStarted = true;
    this.state.isError = false;
    this.state.failed = 0;
    this.state.failedAssets = [];
    this.notify();

    const assetEntries = Object.entries(DERBY_ASSETS);
    this.state.total = assetEntries.length;

    let loadedCount = 0;
    let failedCount = 0;

    const loadPromises = assetEntries.map(async ([key]) => {
      try {
        await preloadDerbyVehicleGLB(key as VehicleId);
        loadedCount += 1;
        this.state.loaded = loadedCount;
        this.state.progress = Math.min(100, Math.round((loadedCount / this.state.total) * 100));
        this.notify();
      } catch (err) {
        console.warn(`[DERBY PRELOADER] Model ${key} load warning:`, err);
        // Fallback procedural vehicle models are built into the engine
        loadedCount += 1;
        this.state.loaded = loadedCount;
        this.state.progress = Math.min(100, Math.round((loadedCount / this.state.total) * 100));
        this.notify();
      }
    });

    await Promise.all(loadPromises);

    this.state.loaded = this.state.total;
    this.state.progress = 100;
    this.state.isReady = true;
    this.state.isError = false;
    this.notify();
  }

  public retry() {
    this.isPreloadingStarted = false;
    this.startPreload();
  }
}

export const derbyAssetPreloader = new DerbyAssetPreloader();
