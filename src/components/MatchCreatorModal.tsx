import React, { useState } from 'react';
import { Player, ModalityType, Match } from '../types/database';
import { X, Calendar, MapPin, Users, Clock, Shield, PlusCircle, Check } from 'lucide-react';
import { generateDefaultPitchCoordinates } from '../lib/teamBalancer';

interface MatchCreatorModalProps {
  groupId: string;
  allPlayers: Player[];
  onSaveMatch: (matchData: Partial<Match>, selectedPlayerIds: string[]) => Promise<void>;
  onClose: () => void;
}

export const MatchCreatorModal: React.FC<MatchCreatorModalProps> = ({
  groupId,
  allPlayers,
  onSaveMatch,
  onClose,
}) => {
  const [title, setTitle] = useState('Pelada Semanal');
  const [matchDate, setMatchDate] = useState(() => {
    const d = new Date();
    d.setHours(19, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('Arena Futebol Clube');
  const [modality, setModality] = useState<ModalityType>('society');
  const [playersPerTeam, setPlayersPerTeam] = useState<number>(7);
  const [startersCount, setStartersCount] = useState<number>(7);
  const [subsCount, setSubsCount] = useState<number>(3);
  const [periods, setPeriods] = useState<number>(2);
  const [periodDuration, setPeriodDuration] = useState<number>(25);

  const [teamAName, setTeamAName] = useState('Time Branco');
  const [teamAColor, setTeamAColor] = useState('#FFFFFF');
  const [teamBName, setTeamBName] = useState('Time Preto');
  const [teamBColor, setTeamBColor] = useState('#1E293B');

  // Participating players
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() =>
    allPlayers.filter((p) => p.is_active).map((p) => p.id)
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick preset modalities
  const handleModalityChange = (m: ModalityType) => {
    setModality(m);
    if (m === 'futsal') {
      setPlayersPerTeam(5);
      setStartersCount(5);
      setSubsCount(3);
    } else if (m === 'society') {
      setPlayersPerTeam(7);
      setStartersCount(7);
      setSubsCount(3);
    } else if (m === 'campo') {
      setPlayersPerTeam(11);
      setStartersCount(11);
      setSubsCount(5);
    }
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedPlayerIds(allPlayers.filter((p) => p.is_active).map((p) => p.id));
  };

  const clearAll = () => {
    setSelectedPlayerIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onSaveMatch(
        {
          group_id: groupId,
          title: title.trim(),
          match_date: new Date(matchDate).toISOString(),
          location: location.trim() || null,
          modality,
          players_per_team: Number(playersPerTeam),
          starters_count: Number(startersCount),
          subs_count: Number(subsCount),
          periods: Number(periods),
          period_duration_minutes: Number(periodDuration),
          status: 'ready',
          team_a_name: teamAName.trim() || 'Time Branco',
          team_a_color: teamAColor,
          team_b_name: teamBName.trim() || 'Time Preto',
          team_b_color: teamBColor,
          score_a: 0,
          score_b: 0,
        },
        selectedPlayerIds
      );
      onClose();
    } catch (err) {
      console.error('Error creating match:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-white">Criar Nova Partida</h2>
          <p className="text-xs text-slate-400">
            Configure formato flexível (5x5, 7x7, 11x11 ou custom) e convoque os jogadores
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Título da Partida *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Pelada de Quarta"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Data e Horário</label>
              <input
                type="datetime-local"
                required
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Local / Campo</label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Arena / Quadra"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-8 pr-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Modality Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Modalidade</label>
            <div className="grid grid-cols-4 gap-2">
              {(['society', 'futsal', 'campo', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModalityChange(m)}
                  className={`py-2 px-1 rounded-xl border text-center text-xs font-bold capitalize transition ${
                    modality === m
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {m === 'custom' ? 'Outro' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Flexible Player Configurations */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              Configuração Flexível de Atletas
            </span>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Jogadores / time
                </label>
                <input
                  type="number"
                  min="2"
                  max="25"
                  value={playersPerTeam}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPlayersPerTeam(val);
                    setStartersCount(val);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-2 text-center text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Titulares
                </label>
                <input
                  type="number"
                  min="2"
                  max="25"
                  value={startersCount}
                  onChange={(e) => setStartersCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-2 text-center text-sm font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Reservas
                </label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={subsCount}
                  onChange={(e) => setSubsCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-2 text-center text-sm font-bold text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 text-slate-400 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Tempos</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={periods}
                  onChange={(e) => setPeriods(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1 px-2 text-center text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Duração / tempo (min)
                </label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={periodDuration}
                  onChange={(e) => setPeriodDuration(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1 px-2 text-center text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Teams Config */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-white">Equipe A</label>
              <input
                type="text"
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-2 text-xs text-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={teamAColor}
                  onChange={(e) => setTeamAColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[10px] text-slate-400">Cor do Colete</span>
              </div>
            </div>

            <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-white">Equipe B</label>
              <input
                type="text"
                value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-2 text-xs text-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={teamBColor}
                  onChange={(e) => setTeamBColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[10px] text-slate-400">Cor do Colete</span>
              </div>
            </div>
          </div>

          {/* Participating Players Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">
                Convocados ({selectedPlayerIds.length} selecionados)
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-emerald-400 hover:underline"
                >
                  Todos
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-400 hover:underline"
                >
                  Nenhum
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
              {allPlayers
                .filter((p) => p.is_active)
                .map((p) => {
                  const isChecked = selectedPlayerIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      className={`p-2 rounded-xl border cursor-pointer text-xs flex items-center justify-between transition select-none ${
                        isChecked
                          ? 'bg-emerald-600/20 border-emerald-500/80 text-white'
                          : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <div className="font-bold truncate">{p.nickname || p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.preferred_position}</div>
                      </div>
                      {isChecked && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                  );
                })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !title.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Criando Partida...' : 'Criar Partida e Escalar ⚽'}
          </button>
        </form>
      </div>
    </div>
  );
};
