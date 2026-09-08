'use client';

import { Suspense } from 'react';
import { DemolitionDerbyGameHub } from '@/components/games/demolition-derby/DemolitionDerbyGameHub';

export default function DemolitionDerbyPage() {
  return (
    <div className="fixed inset-0 w-screen h-screen max-w-full max-h-screen overflow-hidden bg-neutral-950">
      <Suspense
        fallback={
          <div className="w-full h-full bg-black flex items-center justify-center text-white">
            <div className="text-center space-y-3">
              <div className="text-4xl font-black text-white tracking-wide uppercase">
                Ano <span className="text-amber-500">Demolition Derby</span>
              </div>
              <div className="text-gray-400 text-sm">Preparing 3D Derby Arena...</div>
            </div>
          </div>
        }
      >
        <DemolitionDerbyGameHub />
      </Suspense>
    </div>
  );
}
