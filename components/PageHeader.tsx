type PageHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-pitch-white">{title}</h2>
        {subtitle && <div className="text-sm text-pitch-gray">{subtitle}</div>}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  );
}
