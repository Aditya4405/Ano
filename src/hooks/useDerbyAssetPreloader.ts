import { useEffect, useState } from 'react';
import { derbyAssetPreloader, type DerbyPreloadState } from '@/lib/derbyAssetPreloader';

export function useDerbyAssetPreloader(): DerbyPreloadState & { retry: () => void } {
  const [state, setState] = useState<DerbyPreloadState>(derbyAssetPreloader.getState());

  useEffect(() => {
    const unsubscribe = derbyAssetPreloader.subscribe((newState) => {
      setState(newState);
    });

    // Start preloading immediately on mount
    derbyAssetPreloader.startPreload();

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    retry: () => derbyAssetPreloader.retry(),
  };
}
