"use client";

import React from "react";
import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  variant?: "default" | "warning" | "danger";
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  actionHref,
  actionOnClick,
  variant = "default",
}: EmptyStateProps) {
  const variants: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
    default: "bg-zinc-950/70 border-white/10",
    warning: "bg-amber-950/25 border-amber-500/20",
    danger: "bg-red-950/25 border-red-500/25",
  };

  return (
    <div
      className={cx(
        "rounded-2xl border backdrop-blur-md",
        "p-5 sm:p-6",
        "shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
        variants[variant]
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0">
          <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center">
            {icon ?? <span className="text-yellow-300 font-black">!</span>}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-black">{title}</h3>
          {description && (
            <p className="text-sm sm:text-base text-white/70 mt-1 leading-relaxed">
              {description}
            </p>
          )}

          {(actionLabel && (actionHref || actionOnClick)) && (
            <div className="mt-4">
              {actionHref ? (
                <Link
                  href={actionHref}
                  className="inline-flex items-center justify-center h-11 px-4 rounded-xl bg-yellow-400 text-black font-black hover:brightness-110 transition shadow-[0_14px_55px_rgba(255,215,70,0.20)]"
                >
                  {actionLabel}
                </Link>
              ) : (
                <button
                  onClick={actionOnClick}
                  className="inline-flex items-center justify-center h-11 px-4 rounded-xl bg-yellow-400 text-black font-black hover:brightness-110 transition shadow-[0_14px_55px_rgba(255,215,70,0.20)]"
                >
                  {actionLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Carregando..." }: LoadingStateProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-md p-5 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 rounded-full border-2 border-white/25 border-t-yellow-400 animate-spin"
          aria-hidden
        />
        <p className="text-sm sm:text-base text-white/75">{label}</p>
      </div>
    </div>
  );
}
