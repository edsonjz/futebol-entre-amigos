import React from 'react';
import { Calendar, Users, Trophy, Settings, Vote } from 'lucide-react';

export type NavTab = 'matches' | 'players' | 'polls' | 'rankings' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'matches', label: 'Partidas', icon: Calendar },
    { id: 'players', label: 'Jogadores', icon: Users },
    { id: 'polls', label: 'Enquetes', icon: Vote },
    { id: 'rankings', label: 'Rankings', icon: Trophy },
    { id: 'settings', label: 'Grupo', icon: Settings },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'text-emerald-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg ${isActive ? 'bg-emerald-950/80 ring-1 ring-emerald-500/30' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
