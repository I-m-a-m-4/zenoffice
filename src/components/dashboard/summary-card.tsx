import type React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  icon: LucideIcon | string;
  trend?: string;
  trendDirection?: 'up' | 'down';
  href?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, description, icon, trend, trendDirection, href }) => {
  const Icon = typeof icon !== 'string' ? icon : null;
  const iconStr = typeof icon === 'string' ? icon : null;

  const cardContent = (
    <Card className="shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-105 cursor-pointer h-full bg-card/80 backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon ? (
          <Icon className="h-5 w-5 text-muted-foreground" />
        ) : (
          <span className="text-lg font-bold text-muted-foreground opacity-50">{iconStr}</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <p className={`text-xs mt-1 ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
        <Link href={href} className="block h-full">
            {cardContent}
        </Link>
    );
  }

  return cardContent;
};

export default SummaryCard;
