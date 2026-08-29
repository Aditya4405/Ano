'use client';

import { Suspense } from 'react';
import { DemolitionDerbyGameHub } from '@/components/games/demolition-derby/DemolitionDerbyGameHub';

export default function DemolitionDerbyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
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
  );
}
