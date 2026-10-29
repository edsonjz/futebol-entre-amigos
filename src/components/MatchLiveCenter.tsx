import React, { useState, useEffect } from 'react';
import { Match, MatchEvent, MatchRoster, Player, MatchEventType } from '../types/database';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Award,
  AlertTriangle,
  CheckCircle,
  Shirt,
  ArrowRightLeft,
  X
} from 'lucide-react';

interface MatchLiveCenterProps {
  match: Match;
  rosters: MatchRoster[];
  events: MatchEvent[];
  allPlayers: Player[];
  onAddEvent: (event: Omit<MatchEvent, 'id' | 'created_at'>) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onUpdateMatchScore: (scoreA: number, scoreB: number) => Promise<void>;
  onFinishMatch: (mvpPlayerId?: string) => Promise<void>;
  readOnly?: boolean;
}

export const MatchLiveCenter: React.FC<MatchLiveCenterProps> = ({
  match,
  rosters,
  events,
  allPlayers,
  onAddEvent,
  onDeleteEvent,
  onUpdateMatchScore,
  onFinishMatch,
  readOnly = false,
}) => {
  // Timer state
  const [seconds, setSeconds] = useState(match.current_minute * 60 || 0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState(match.current_period || 1);

  // Modals for actions
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Goal Form State
  const [goalTeam, setGoalTeam] = useState<'A' | 'B'>('A');
  const [goalScorerId, setGoalScorerId] = useState<string>('');
  const [goalAssistantId, setGoalAssistantId] = useState<string>('');
  const [isOwnGoal, setIsOwnGoal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Substitution Form State
  const [subTeam, setSubTeam] = useState<'A' | 'B'>('A');
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');

  // Card Form State
  const [cardTeam, setCardTeam] = useState<'A' | 'B'>('A');
  const [cardPlayerId, setCardPlayerId] = useState<string>('');
  const [cardType, setCardType] = useState<'yellow_card' | 'red_card'>('yellow_card');

  // MVP selection for match finish
  const [selectedMvpId, setSelectedMvpId] = useState<string>('');

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const currentMinute = Math.floor(seconds / 60);
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60
  ).padStart(2, '0')}`;

  const teamAPlayers = rosters
    .filter((r) => r.team === 'A')
    .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
    .filter((p): p is Player => Boolean(p));

  const teamBPlayers = rosters
    .filter((r) => r.team === 'B')
    .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
    .filter((p): p is Player => Boolean(p));

  // Instant 1-tap Goal Registration (for both form and direct button click)
  const submitQuickGoal = async (scorerId: string, assistantId: string | null = null, ownGoal = isOwnGoal) => {
    if (isSubmitting || !scorerId) return;
    setIsSubmitting(true);

    try {
      const newScoreA = goalTeam === 'A' ? match.score_a + 1 : match.score_a;
      const newScoreB = goalTeam === 'B' ? match.score_b + 1 : match.score_b;

      await onAddEvent({
        match_id: match.id,
        team: goalTeam,
        event_type: ownGoal ? 'own_goal' : 'goal',
        player_id: scorerId,
        assist_player_id: assistantId || null,
        minute: currentMinute,
        period: currentPeriod,
        details: ownGoal ? 'Gol Contra' : undefined,
      });

      await onUpdateMatchScore(newScoreA, newScoreB);

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });

      setShowGoalModal(false);
      setGoalScorerId('');
      setGoalAssistantId('');
      setIsOwnGoal(false);
    } catch (err) {
      console.error('Error saving goal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Goal Registration
  const handleRegisterGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuickGoal(goalScorerId, goalAssistantId || null, isOwnGoal);
  };


  // Handle Substitution Registration
  const handleRegisterSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !subOutId || !subInId) return;
    setIsSubmitting(true);

    try {
      await onAddEvent({
        match_id: match.id,
        team: subTeam,
        event_type: 'substitution',
        player_id: subInId, // Player who entered
        assist_player_id: subOutId, // Player who exited
        minute: currentMinute,
        period: currentPeriod,
        details: 'Substituição',
      });

      setShowSubModal(false);
      setSubOutId('');
      setSubInId('');
    } catch (err) {
      console.error('Error saving sub:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Card Registration
  const handleRegisterCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !cardPlayerId) return;
    setIsSubmitting(true);

    try {
      await onAddEvent({
        match_id: match.id,
        team: cardTeam,
        event_type: cardType,
        player_id: cardPlayerId,
        assist_player_id: null,
        minute: currentMinute,
        period: currentPeriod,
      });

      setShowCardModal(false);
      setCardPlayerId('');
    } catch (err) {
      console.error('Error saving card:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete event with rollback of score
  const handleDeleteEventClick = async (event: MatchEvent) => {
    if (readOnly) return;
    const confirmDelete = window.confirm('Deseja realmente excluir este evento?');
    if (!confirmDelete) return;

    if (event.event_type === 'goal' || event.event_type === 'own_goal') {
      const newScoreA = event.team === 'A' ? Math.max(0, match.score_a - 1) : match.score_a;
      const newScoreB = event.team === 'B' ? Math.max(0, match.score_b - 1) : match.score_b;
      await onUpdateMatchScore(newScoreA, newScoreB);
    }

    await onDeleteEvent(event.id);
  };

  return (
    <div className="space-y-4">
      {/* SCOREBOARD DISPLAY */}
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-16 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none"></div>

        {/* Period & Clock Controls */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              {currentPeriod}º TEMPO
            </span>
            {!readOnly && (
              <button
                onClick={() => setCurrentPeriod(currentPeriod === 1 ? 2 : 1)}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
              >
                Alternar Tempo
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-sm sm:text-base font-bold text-emerald-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formattedTime}</span>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className={`p-2 rounded-xl transition ${
                    isRunning
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={isRunning ? 'Pausar Cronômetro' : 'Iniciar Cronômetro'}
                >
                  {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <button
                  onClick={() => {
                    setIsRunning(false);
                    setSeconds(0);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Zerar Cronômetro"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Big Score Counter */}
        <div className="grid grid-cols-5 items-center text-center">
          {/* Team A */}
          <div className="col-span-2 flex flex-col items-center">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-white/20 mb-2"
              style={{ backgroundColor: match.team_a_color || '#FFFFFF' }}
            >
              <Shirt className="w-6 h-6 sm:w-8 sm:h-8 text-slate-900" />
            </div>
            <h2 className="font-black text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-none">
              {match.team_a_name}
            </h2>
            <span className="text-[11px] text-slate-400">
              {teamAPlayers.length} jogadores
            </span>
          </div>

          {/* Scores */}
          <div className="col-span-1 flex items-center justify-center gap-2 sm:gap-3">
            <span className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              {match.score_a}
            </span>
            <span className="text-xl sm:text-3xl font-bold text-slate-600">×</span>
            <span className="text-4xl sm:text-6xl font-black text-white tracking-tight">
              {match.score_b}
            </span>
          </div>

          {/* Team B */}
          <div className="col-span-2 flex flex-col items-center">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-white/20 mb-2"
              style={{ backgroundColor: match.team_b_color || '#1E293B' }}
            >
              <Shirt className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="font-black text-sm sm:text-base text-white truncate max-w-[120px] sm:max-w-none">
              {match.team_b_name}
            </h2>
            <span className="text-[11px] text-slate-400">
              {teamBPlayers.length} jogadores
            </span>
          </div>
        </div>
      </div>

      {/* BIG OPERATIONAL ACTION BUTTONS (Mobile optimized) */}
      {!readOnly && match.status !== 'finished' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => {
              setGoalTeam('A');
              setShowGoalModal(true);
            }}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl bg-gradient-to-b from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-950/60 active:scale-95 transition"
          >
            <span className="text-2xl">⚽</span>
            <span>REGISTRAR GOL</span>
          </button>

          <button
            onClick={() => {
              setSubTeam('A');
              setShowSubModal(true);
            }}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl bg-gradient-to-b from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-sky-950/60 active:scale-95 transition"
          >
            <ArrowRightLeft className="w-6 h-6" />
            <span>SUBSTITUIÇÃO</span>
          </button>

          <button
            onClick={() => {
              setCardTeam('A');
              setShowCardModal(true);
            }}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs sm:text-sm shadow-xl shadow-amber-950/60 active:scale-95 transition"
          >
            <div className="flex gap-1 text-base">🟨 🟥</div>
            <span>CARTÃO</span>
          </button>

          <button
            onClick={() => setShowFinishModal(true)}
            className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl bg-gradient-to-b from-rose-700 to-red-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-950/60 active:scale-95 transition"
          >
            <Award className="w-6 h-6 text-amber-300" />
            <span>ENCERRAR JOGO</span>
          </button>
        </div>
      )}

      {/* MATCH EVENTS TIMELINE FEED */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
        <h3 className="font-bold text-sm text-white mb-3 flex items-center justify-between">
          <span>Linha do Tempo dos Acontecimentos</span>
          <span className="text-xs text-slate-500 font-normal">
            {events.length} {events.length === 1 ? 'registro' : 'registros'}
          </span>
        </h3>

        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Nenhum evento registrado ainda. Utilize os botões acima para registrar gols e substituições.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {events
              .sort((a, b) => b.minute - a.minute)
              .map((event) => {
                const scorer = allPlayers.find((p) => p.id === event.player_id);
                const assist = allPlayers.find((p) => p.id === event.assist_player_id);
                const isA = event.team === 'A';
                const teamName = isA ? match.team_a_name : match.team_b_name;

                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                        {event.minute}'
                      </span>

                      {event.event_type === 'goal' && <span className="text-base">⚽</span>}
                      {event.event_type === 'own_goal' && <span className="text-base">🥅 (Contra)</span>}
                      {event.event_type === 'substitution' && (
                        <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                      )}
                      {event.event_type === 'yellow_card' && <span className="text-sm">🟨</span>}
                      {event.event_type === 'red_card' && <span className="text-sm">🟥</span>}

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">
                            {scorer?.nickname || scorer?.name || 'Jogador'}
                          </span>
                          <span className="text-slate-400 text-[11px]">({teamName})</span>
                        </div>

                        {assist && event.event_type === 'goal' && (
                          <p className="text-[11px] text-emerald-300">
                            Assistência: {assist.nickname || assist.name}
                          </p>
                        )}
                        {assist && event.event_type === 'substitution' && (
                          <p className="text-[11px] text-slate-400">
                            Saiu: {assist.nickname || assist.name}
                          </p>
                        )}
                      </div>
                    </div>

                    {!readOnly && (
                      <button
                        onClick={() => handleDeleteEventClick(event)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition"
                        title="Remover evento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* REGISTRAR GOL MODAL (AGILE 1-TAP VISUAL FLOW) */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowGoalModal(false);
                setGoalScorerId('');
                setGoalAssistantId('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">⚽</span> Registrar Gol Rápido
            </h3>

            <div className="space-y-4">
              {/* Select Team */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">1. Equipe que marcou</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoalTeam('A');
                      setGoalScorerId('');
                      setGoalAssistantId('');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      goalTeam === 'A'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span>{match.team_a_name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGoalTeam('B');
                      setGoalScorerId('');
                      setGoalAssistantId('');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      goalTeam === 'B'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span>{match.team_b_name}</span>
                  </button>
                </div>
              </div>

              {/* Step 1: Select Author of Goal */}
              {!goalScorerId ? (
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-2">
                    2. Toque em quem fez o Gol:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                    {(goalTeam === 'A' ? teamAPlayers : teamBPlayers).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGoalScorerId(p.id)}
                        className="p-2.5 rounded-2xl bg-slate-800 hover:bg-emerald-950/70 border border-slate-700 hover:border-emerald-500 text-left transition flex items-center gap-2 active:scale-95"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                          {p.nickname?.[0] || p.name[0]}
                        </div>
                        <span className="text-xs font-bold text-white truncate">
                          {p.nickname || p.name.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Step 2: 1-Tap Assist or No Assist */
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <span className="text-xs text-slate-300">
                      Autor do Gol:{' '}
                      <strong className="text-emerald-400">
                        {(goalTeam === 'A' ? teamAPlayers : teamBPlayers).find((p) => p.id === goalScorerId)?.nickname ||
                          (goalTeam === 'A' ? teamAPlayers : teamBPlayers).find((p) => p.id === goalScorerId)?.name}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setGoalScorerId('')}
                      className="text-[11px] text-amber-400 hover:underline font-bold"
                    >
                      Trocar Autor
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitQuickGoal(goalScorerId, null, false)}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 transition active:scale-95"
                  >
                    ⚡ GOL SEM ASSISTÊNCIA (1 TOQUE)
                  </button>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">
                      👟 Ou toque em quem deu a Assistência (já salva na hora):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {(goalTeam === 'A' ? teamAPlayers : teamBPlayers)
                        .filter((p) => p.id !== goalScorerId)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => submitQuickGoal(goalScorerId, p.id, false)}
                            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-emerald-950/70 border border-slate-700 hover:border-emerald-500 text-left transition flex items-center gap-2 active:scale-95"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold text-sky-400 shrink-0">
                              👟
                            </div>
                            <span className="text-xs font-bold text-white truncate">
                              {p.nickname || p.name.split(' ')[0]}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitQuickGoal(goalScorerId, null, true)}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-400 border border-slate-700 text-xs font-bold transition"
                  >
                    Registrar como Gol Contra
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* SUBSTITUIÇÃO MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowSubModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-sky-400" /> Registrar Substituição
            </h3>

            <form onSubmit={handleRegisterSub} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Equipe</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubTeam('A')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                      subTeam === 'A'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {match.team_a_name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTeam('B')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                      subTeam === 'B'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {match.team_b_name}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-400 mb-1">Jogador que Sai</label>
                <select
                  required
                  value={subOutId}
                  onChange={(e) => setSubOutId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
                >
                  <option value="">Selecione quem sai...</option>
                  {(subTeam === 'A' ? teamAPlayers : teamBPlayers).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1">Jogador que Entra</label>
                <select
                  required
                  value={subInId}
                  onChange={(e) => setSubInId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
                >
                  <option value="">Selecione quem entra...</option>
                  {(subTeam === 'A' ? teamAPlayers : teamBPlayers)
                    .filter((p) => p.id !== subOutId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nickname || p.name}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !subOutId || !subInId}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition"
              >
                {isSubmitting ? 'Salvando...' : 'Confirmar Substituição'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZAR PARTIDA MODAL */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-4">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white mb-1">Finalizar Partida?</h3>
            <p className="text-xs text-slate-400 mb-4">
              O placar final será registrado como {match.score_a} × {match.score_b}. As estatísticas
              históricas serão consolidadas.
            </p>

            {/* Select MVP */}
            <div className="text-left mb-5">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Eleger o Craque da Partida (MVP)
              </label>
              <select
                value={selectedMvpId}
                onChange={(e) => setSelectedMvpId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
              >
                <option value="">Selecione o MVP da partida (Opcional)...</option>
                {[...teamAPlayers, ...teamBPlayers].map((p) => (
                  <option key={p.id} value={p.id}>
                    ⭐ {p.nickname || p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Continuar Jogo
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowFinishModal(false);
                  await onFinishMatch(selectedMvpId || undefined);
                }}
                className="py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-lg shadow-rose-950/50 transition"
              >
                Sim, Encerrar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
