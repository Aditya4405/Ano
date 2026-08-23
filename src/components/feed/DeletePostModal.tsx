"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface DeletePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function DeletePostModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeletePostModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isDeleting ? onClose : undefined}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 text-center z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-lg shadow-red-500/10">
            <Trash2 className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">Delete Post?</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete this post? This action cannot be undone and all associated comments will be removed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
