"use client";

import { motion } from "framer-motion";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-2xl bg-zinc-900/80 border border-white/10 shadow-lg backdrop-blur p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
