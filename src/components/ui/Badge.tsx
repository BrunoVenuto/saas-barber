export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "danger" | "warning";
}) {
  const styles = {
    default: "bg-white/10 text-white",
    success: "bg-green-500/20 text-green-400",
    danger: "bg-red-500/20 text-red-400",
    warning: "bg-yellow-500/20 text-yellow-400",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
