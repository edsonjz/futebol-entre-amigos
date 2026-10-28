import React, { useState } from 'react';
import { PlayerStats, PlayerPosition } from '../types/database';
import { Trophy, Target, Award, Star, Flame, Shield, Info, Filter } from 'lucide-react';

interface RankingsViewProps {
  stats: PlayerStats[];
}

type RankingCategory = 'overall' | 'goals' | 'assists' | 'rating' | 'winrate' | 'goalkeeper' | 'mvp';

export const RankingsView: React.FC<RankingsViewProps> = ({ stats }) => {
  const [activeCategory, setActiveCategory] = useState<RankingCategory>('overall');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [minMatches, setMinMatches] = useState<number>(0);
  const [showFormulaInfo, setShowFormulaInfo] = useState<boolean>(false);

  // Filter stats
  const filtered = stats.filter((s) => {
    if (minMatches > 0 && s.matches_played < minMatches) return false;
    if (positionFilter !== 'all' && s.player.preferred_position !== positionFilter) return false;
    return true;
  });

  // Sort based on category
  const sorted = [...filtered].sort((a, b) => {
    switch (activeCategory) {
      case 'overall':
        return b.overall_index - a.overall_index || b.matches_played - a.matches_played;
      case 'goals':
        return b.goals - a.goals || b.goals_per_match - a.goals_per_match;
      case 'assists':
        return b.assists - a.assists;
      case 'rating':
        return b.average_rating - a.average_rating || b.ratings_count - a.ratings_count;
      case 'winrate':
        return b.win_rate - a.win_rate || b.wins - a.wins;
      case 'goalkeeper':
        return b.average_rating - a.average_rating;
      case 'mvp':
        return b.mvp_count - a.mvp_count;
      default:
        return 0;
    }
  });

  const categories = [
    { id: 'overall', label: 'Índice Geral', icon: Trophy, color: 'text-amber-400' },
    { id: 'goals', label: 'Artilharia', icon: Target, color: 'text-emerald-400' },
    { id: 'assists', label: 'Garçons', icon: Award, color: 'text-sky-400' },
    { id: 'rating', label: 'Melhor Nota', icon: Star, color: 'text-yellow-400' },
    { id: 'winrate', label: 'Aproveitamento', icon: Flame, color: 'text-rose-400' },
    { id: 'goalkeeper', label: 'Goleiros', icon: Shield, color: 'text-purple-400' },
    { id: 'mvp', label: 'MVPs', icon: Trophy, color: 'text-amber-300' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-3xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Rankings & Estatísticas</span>
          </h2>
          <p className="text-xs text-slate-400">
            Calculado automaticamente a partir de todos os jogos oficiais registrados
          </p>
        </div>

        <button
          onClick={() => setShowFormulaInfo(!showFormulaInfo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold border border-slate-700 w-fit"
        >
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          <span>Como funciona a pontuação?</span>
        </button>
      </div>

      {/* Formula Explanation Banner */}
      {showFormulaInfo && (
        <div className="p-4 bg-slate-900/90 border border-emerald-500/30 rounded-2xl text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between text-emerald-400 font-bold">
            <span>Fórmula Transparente do Índice Geral (0 a 100)</span>
            <button onClick={() => setShowFormulaInfo(false)} className="text-slate-400 hover:text-white">
              ×
            </button>
          </div>
          <p className="text-slate-400">
            O ranking não se baseia apenas no número absoluto de gols para não beneficiar injustamente quem
            jogou mais partidas. A pontuação é calculada de forma equilibrada:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li>
              <strong className="text-white">50% — Avaliação Subjetiva:</strong> Média das notas pós-jogo dadas pelos colegas (0 a 10 convertida para 0-100).
            </li>
            <li>
              <strong className="text-white">30% — Eficiência Individual:</strong> Gols e assistências ponderados pela quantidade de partidas jogadas.
            </li>
            <li>
              <strong className="text-white">20% — Desempenho Coletivo:</strong> Percentual de vitórias e pontos conquistados pela equipe quando esteve em campo.
            </li>
          </ul>
        </div>
      )}

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id as RankingCategory);
                if (cat.id === 'goalkeeper') {
                  setPositionFilter('Goleiro');
                } else if (positionFilter === 'Goleiro') {
                  setPositionFilter('all');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition border ${
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : cat.color}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-4 py-2.5 rounded-2xl text-xs text-slate-400">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <span>Posição:</span>
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
          >
            <option value="all">Todas as posições</option>
            <option value="Goleiro">Goleiro</option>
            <option value="Zagueiro">Zagueiro</option>
            <option value="Lateral">Lateral</option>
            <option value="Meio-campo">Meio-campo</option>
            <option value="Atacante">Atacante</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-5 shadow-xl space-y-2.5">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Nenhum jogador encontrado com os filtros selecionados.
          </div>
        ) : (
          sorted.map((item, index) => {
            const isTop1 = index === 0;
            const isTop2 = index === 1;
            const isTop3 = index === 2;

            let rankBadge = (
              <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-400">
                {index + 1}
              </span>
            );

            if (isTop1) {
              rankBadge = (
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 flex items-center justify-center font-black text-xs text-slate-950 shadow-lg shadow-amber-950/50 ring-2 ring-amber-400/50">
                  1º
                </span>
              );
            } else if (isTop2) {
              rankBadge = (
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center font-black text-xs text-slate-950 ring-1 ring-slate-300">
                  2º
                </span>
              );
            } else if (isTop3) {
              rankBadge = (
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center font-black text-xs text-amber-200 ring-1 ring-amber-700">
                  3º
                </span>
              );
            }

            return (
              <div
                key={item.player_id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                  isTop1
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  {rankBadge}

                  {/* Player Avatar */}
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden ring-1 ring-slate-600">
                    {item.player.photo_url ? (
                      <img
                        src={item.player.photo_url}
                        alt={item.player.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{item.player.nickname?.[0] || item.player.name[0]}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white">
                        {item.player.nickname || item.player.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {item.player.preferred_position}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {item.matches_played} {item.matches_played === 1 ? 'jogo' : 'jogos'} • {item.wins} vitórias ({item.win_rate}%)
                    </p>
                  </div>
                </div>

                {/* Score / Metric Pill */}
                <div className="text-right">
                  {activeCategory === 'overall' && (
                    <div className="flex flex-col items-end">
                      <span className="px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 font-black text-sm shadow">
                        {item.overall_index}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Overall</span>
                    </div>
                  )}

                  {activeCategory === 'goals' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-emerald-400 text-base">
                        {item.goals} ⚽
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.goals_per_match} g/jogo
                      </span>
                    </div>
                  )}

                  {activeCategory === 'assists' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-sky-400 text-base">
                        {item.assists} 🎯
                      </span>
                      <span className="text-[10px] text-slate-500">passes a gol</span>
                    </div>
                  )}

                  {activeCategory === 'rating' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-amber-400 text-base">
                        {item.average_rating.toFixed(1)} ⭐
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.ratings_count} avaliações
                      </span>
                    </div>
                  )}

                  {activeCategory === 'winrate' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-rose-400 text-base">
                        {item.win_rate}%
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {item.wins}V / {item.draws}E / {item.losses}D
                      </span>
                    </div>
                  )}

                  {activeCategory === 'goalkeeper' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-purple-400 text-base">
                        {item.average_rating.toFixed(1)} ⭐
                      </span>
                      <span className="text-[10px] text-slate-500">Nota Média</span>
                    </div>
                  )}

                  {activeCategory === 'mvp' && (
                    <div className="flex flex-col items-end">
                      <span className="font-black text-amber-300 text-base">
                        {item.mvp_count} 🏆
                      </span>
                      <span className="text-[10px] text-slate-500">Craque da Partida</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
