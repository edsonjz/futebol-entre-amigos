import React, { useState } from 'react';
import { Match, MatchRoster, Player, PlayerRating } from '../types/database';
import { useAuth } from '../context/AuthContext';
import { Star, X, Check, Trophy, Sparkles } from 'lucide-react';
import { MatchMvpPollBanner } from './MatchMvpPollBanner';

interface MatchRatingModalProps {
  match: Match;
  rosters: MatchRoster[];
  allPlayers: Player[];
  existingRatings: PlayerRating[];
  onSubmitRating: (rating: Omit<PlayerRating, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}

export const MatchRatingModal: React.FC<MatchRatingModalProps> = ({
  match,
  rosters,
  allPlayers,
  existingRatings,
  onSubmitRating,
  onClose,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'mvp' | 'ratings'>('mvp');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [overallScore, setOverallScore] = useState<number>(7.0);
  const [showDetailed, setShowDetailed] = useState(false);
  const [technical, setTechnical] = useState<number>(7.0);
  const [tactical, setTactical] = useState<number>(7.0);
  const [physical, setPhysical] = useState<number>(7.0);
  const [teamwork, setTeamwork] = useState<number>(7.0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  // Participating players in this match
  const participatingPlayers = rosters
    .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
    .filter((p): p is Player => Boolean(p));

  const currentUserId = user?.id || 'fd711bee-d6bb-491e-8b03-3d2b61b8c7c9';

  const alreadyRatedIds = new Set(
    existingRatings
      .filter((r) => r.match_id === match.id && r.evaluator_id === currentUserId)
      .map((r) => r.evaluated_player_id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onSubmitRating({
        match_id: match.id,
        evaluated_player_id: selectedPlayerId,
        evaluator_id: currentUserId,
        rating: overallScore,
        technical: showDetailed ? technical : null,
        tactical: showDetailed ? tactical : null,
        physical: showDetailed ? physical : null,
        teamwork: showDetailed ? teamwork : null,
        comment: comment.trim() || null,
      });

      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        setSelectedPlayerId('');
        setComment('');
      }, 1500);
    } catch (err) {
      console.error('Error saving rating:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-2">
            <Trophy className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-white">Fim de Jogo • Craque & Notas</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {match.title} • Placar final: {match.team_a_name} {match.score_a} × {match.score_b} {match.team_b_name}
          </p>
        </div>

        {/* Mode Switcher: Enquete do Craque vs Notas 0-10 */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('mvp')}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
              activeTab === 'mvp'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>🏆 Enquete Craque do Jogo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ratings')}
            className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition ${
              activeTab === 'ratings'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>⭐ Notas Individuais</span>
          </button>
        </div>

        {activeTab === 'mvp' ? (
          <div className="space-y-3">
            <MatchMvpPollBanner match={match} allPlayers={allPlayers} compact />
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Nota registrada com sucesso!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Select Player to rate */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Selecione o Jogador para Dar Nota (0 a 10)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {participatingPlayers.map((player) => {
                    const isRated = alreadyRatedIds.has(player.id);
                    const isSelected = selectedPlayerId === player.id;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2 ${
                          isSelected
                            ? 'bg-emerald-600/20 border-emerald-500 text-white font-bold ring-1 ring-emerald-500'
                            : isRated
                            ? 'bg-slate-800/40 border-slate-800 text-slate-400'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                          {player.nickname?.[0] || player.name[0]}
                        </div>
                        <div className="truncate flex-1">
                          <div className="truncate">{player.nickname || player.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {isRated ? '✓ Já avaliado' : player.preferred_position}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPlayerId && (
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  {/* Overall Rating Slider */}
                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-center">
                    <span className="text-xs font-bold text-slate-400 block mb-1">Nota Geral</span>
                    <div className="text-4xl font-black text-amber-400 mb-2">
                      {overallScore.toFixed(1)}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={overallScore}
                      onChange={(e) => setOverallScore(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-bold">
                      <span>0 (Fraco)</span>
                      <span>5 (Regular)</span>
                      <span>10 (Craque)</span>
                    </div>
                  </div>

                  {/* Toggle Detailed Criteria */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowDetailed(!showDetailed)}
                      className="text-xs text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {showDetailed
                          ? 'Ocultar critérios detalhados'
                          : 'Avaliar critérios específicos'}
                      </span>
                    </button>
                  </div>

                  {showDetailed && (
                    <div className="space-y-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
                          <span>Técnica / Habilidade</span>
                          <span className="text-emerald-400 font-bold">{technical.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={technical}
                          onChange={(e) => setTechnical(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
                          <span>Tática / Posicionamento</span>
                          <span className="text-emerald-400 font-bold">{tactical.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={tactical}
                          onChange={(e) => setTactical(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
                          <span>Físico / Marcação</span>
                          <span className="text-emerald-400 font-bold">{physical.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={physical}
                          onChange={(e) => setPhysical(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
                          <span>Trabalho em Equipe / Passe</span>
                          <span className="text-emerald-400 font-bold">{teamwork.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={teamwork}
                          onChange={(e) => setTeamwork(parseFloat(e.target.value))}
                          className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Comentário (Opcional)
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ex: Jogou muito na defesa e distribuiu bem o jogo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-950/40 transition active:scale-95"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar Avaliação ⭐'}
                  </button>
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
};
