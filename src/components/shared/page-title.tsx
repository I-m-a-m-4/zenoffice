import type React from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode; // For actions like buttons
}

const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle, children }) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
};

export default PageTitle;
