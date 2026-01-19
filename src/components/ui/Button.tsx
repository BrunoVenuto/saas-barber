"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "danger" | "ghost";
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "rounded-xl px-5 py-3 font-bold transition-all duration-200 focus:outline-none";

  const styles = {
    primary:
      "bg-orange-500 text-black hover:bg-orange-400 shadow-lg shadow-orange-500/20",
    danger:
      "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20",
    ghost: "bg-white/5 hover:bg-white/10 text-white",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      {...props}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
