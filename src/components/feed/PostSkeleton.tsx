"use client";

import React from "react";

export function PostSkeleton() {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 animate-pulse space-y-3">
      {/* Author row */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-full bg-white/10" />
        <div className="w-24 h-3.5 rounded bg-white/10" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
        <div className="w-12 h-3 rounded bg-white/10" />
      </div>

      {/* Content lines */}
      <div className="space-y-2 py-1">
        <div className="w-full h-3.5 rounded bg-white/10" />
        <div className="w-4/5 h-3.5 rounded bg-white/10" />
        <div className="w-3/5 h-3.5 rounded bg-white/10" />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 pt-2">
        <div className="w-16 h-7 rounded-full bg-white/10" />
        <div className="w-24 h-7 rounded-full bg-white/10" />
        <div className="w-16 h-7 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
