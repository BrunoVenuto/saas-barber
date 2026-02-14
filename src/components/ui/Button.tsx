"use client";

import React from "react";

type ButtonVariant = "primary" | "ghost" | "danger" | "success";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const base =
    "inline-flex items-center justify-center gap-2 " +
    "rounded-xl font-black transition select-none " +
    "h-11 sm:h-12 px-4 sm:px-5 " +
    "border " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-yellow-400 text-black border-yellow-300/30 " +
      "hover:brightness-110 " +
      "shadow-[0_14px_55px_rgba(255,215,70,0.22)]",
    ghost:
      "bg-white/10 text-white border-white/10 " +
      "hover:bg-white/15 hover:border-white/15",
    danger:
      "bg-red-600 text-white border-red-500/30 " +
      "hover:bg-red-500",
    success:
      "bg-emerald-500 text-black border-emerald-400/30 " +
      "hover:brightness-110",
  };

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={cx(base, variants[variant], className)}
    >
      {loading && (
        <span
          className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
