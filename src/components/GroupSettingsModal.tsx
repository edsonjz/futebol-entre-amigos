import React, { useState } from 'react';
import { Group, ModalityType } from '../types/database';
import { X, Settings, Sliders, Shield, Save } from 'lucide-react';

interface GroupSettingsModalProps {
  group: Group;
  onSaveGroup: (updatedGroup: Partial<Group>) => Promise<void>;
  onClose: () => void;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  group,
  onSaveGroup,
  onClose,
}) => {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [defaultModality, setDefaultModality] = useState<ModalityType>(group.default_modality || 'society');
  const [defaultPlayers, setDefaultPlayers] = useState<number>(group.default_players_per_team || 7);
  
  // Weights for Overall Index (50% ratings, 30% stats, 20% team)
  const [weightRatings, setWeightRatings] = useState<number>(group.settings?.overall_weight_ratings ?? 50);
  const [weightStats, setWeightStats] = useState<number>(group.settings?.overall_weight_stats ?? 30);
  const [weightTeam, setWeightTeam] = useState<number>(group.settings?.overall_weight_team ?? 20);
  const [enableFinances, setEnableFinances] = useState<boolean>(group.settings?.enable_finances ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onSaveGroup({
        name: name.trim(),
        description: description.trim() || null,
        default_modality: defaultModality,
        default_players_per_team: defaultPlayers,
        settings: {
          overall_weight_ratings: weightRatings,
          overall_weight_stats: weightStats,
          overall_weight_team: weightTeam,
          enable_finances: enableFinances,
        },
      });
      onClose();
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
            <Settings className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-white">Configurações do Grupo</h2>
          <p className="text-xs text-slate-400">Personalize o grupo de futebol, regras e pontuação</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Grupo *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Pelada toda quarta às 20h"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Modalidade Padrão</label>
              <select
                value={defaultModality}
                onChange={(e) => setDefaultModality(e.target.value as ModalityType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
              >
                <option value="society">Society</option>
                <option value="futsal">Futsal</option>
                <option value="campo">Campo</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Jogadores / Time Padrão
              </label>
              <input
                type="number"
                min="2"
                max="25"
                value={defaultPlayers}
                onChange={(e) => setDefaultPlayers(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-center text-xs text-white font-bold"
              />
            </div>
          </div>

          {/* Transparent Overall Index Weights */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Pesos do Índice Geral (Overall 0-100)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ajuste como a fórmula transparente combina notas, gols e vitórias:
            </p>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Nota Média das Avaliações</span>
                <span className="font-bold text-white">{weightRatings}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightRatings}
                onChange={(e) => setWeightRatings(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Estatísticas Individuais (Gols / Assist.)</span>
                <span className="font-bold text-white">{weightStats}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightStats}
                onChange={(e) => setWeightStats(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Desempenho Coletivo (% Vitórias)</span>
                <span className="font-bold text-white">{weightTeam}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={weightTeam}
                onChange={(e) => setWeightTeam(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
              />
            </div>
          </div>

          {/* Financial module toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white block">Módulo Financeiro</span>
              <span className="text-[10px] text-slate-400">
                Habilita controle de valor do campo e pagamentos por jogador.
              </span>
            </div>
            <input
              type="checkbox"
              checked={enableFinances}
              onChange={(e) => setEnableFinances(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};
