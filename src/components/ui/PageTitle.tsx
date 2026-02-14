export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-black tracking-tight text-white">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-white/50">{subtitle}</p>
      )}
    </div>
  );
}
