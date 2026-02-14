import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

function cx(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

/**
 * Card padrão do Admin (mobile-first)
 * - Mantém o estilo escuro
 * - Bordas suaves + leve glass
 * - Padding responsivo
 */
export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-md",
        "shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
        "p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
