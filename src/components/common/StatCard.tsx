import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  active?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'cyan',
  trend,
  onClick,
  active,
}) => {
  const variantGradients = {
    cyan: 'from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
    emerald: 'from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
    rose: 'from-rose-500/20 via-rose-500/5 to-transparent border-rose-500/30 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
    indigo: 'from-indigo-500/20 via-indigo-500/5 to-transparent border-indigo-500/30 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
    slate: 'from-slate-500/10 via-slate-500/5 to-transparent border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300',
  };

  const accentTopBars = {
    cyan: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-500',
    rose: 'bg-gradient-to-r from-rose-500 to-pink-500',
    indigo: 'bg-gradient-to-r from-indigo-500 to-purple-500',
    slate: 'bg-gradient-to-r from-slate-400 to-slate-600',
  };

  const iconStyles = {
    cyan: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 ring-1 ring-cyan-500/30 shadow-md shadow-cyan-500/10',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-500/10',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/30 shadow-md shadow-rose-500/10',
    indigo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/30 shadow-md shadow-indigo-500/10',
    slate: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700',
  };

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden p-4 rounded-2xl border transition-all duration-300 shadow-md hover:shadow-xl ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${
        active
          ? 'ring-2 ring-cyan-500 border-transparent bg-cyan-500/5'
          : 'border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950/80 backdrop-blur-xl'
      }`}
    >
      {/* Top accent colorful gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentTopBars[variant]}`} />

      {/* Ambient background glow gradient */}
      <div className={`absolute -right-10 -bottom-10 w-28 h-28 rounded-full blur-2xl pointer-events-none bg-gradient-to-br ${variantGradients[variant]}`} />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase font-mono">
            {title}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono tracking-tight drop-shadow-sm">
            {value}
          </div>
        </div>
        <div className={`p-2.5 rounded-xl transition-transform hover:scale-110 ${iconStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="relative z-10 mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
          {subtext && <span className="text-slate-500 dark:text-slate-400 font-medium">{subtext}</span>}
          {trend && (
            <span
              className={`font-semibold font-mono ${
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
