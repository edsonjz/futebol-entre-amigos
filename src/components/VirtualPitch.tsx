import React, { useState, useRef } from 'react';
import { Player, MatchRoster, Match, MatchEvent } from '../types/database';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import {
  Shuffle,
  Scale,
  Download,
  Share2,
  Info,
  Move,
  X,
  Zap,
  ArrowRightLeft,
  Trash2,
  Award,
  CheckCircle2,
  User
} from 'lucide-react';
import { balanceTeams, drawRandomTeams, generateDefaultPitchCoordinates } from '../lib/teamBalancer';

interface VirtualPitchProps {
  match: Match;
  rosters: MatchRoster[];
  events: MatchEvent[];
  allPlayers: Player[];
  onUpdateRosters: (newRosters: MatchRoster[]) => Promise<void>;
  onAddEvent: (event: Omit<MatchEvent, 'id' | 'created_at'>) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onUpdateMatchScore: (scoreA: number, scoreB: number) => Promise<void>;
  onFinishMatch?: (mvpPlayerId?: string) => Promise<void>;
  readOnly?: boolean;
}

export const VirtualPitch: React.FC<VirtualPitchProps> = ({
  match,
  rosters,
  events,
  allPlayers,
  onUpdateRosters,
  onAddEvent,
  onDeleteEvent,
  onUpdateMatchScore,
  onFinishMatch,
  readOnly = false,
}) => {
  const pitchRef = useRef<HTMLDivElement>(null);

  // Quick Goal / Action Popover state when clicking a player on the pitch
  const [activeActionRoster, setActiveActionRoster] = useState<MatchRoster | null>(null);
  const [showSubSelector, setShowSubSelector] = useState(false);
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);

  // Move position mode state
  const [movingRosterId, setMovingRosterId] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [balanceNote, setBalanceNote] = useState<string | null>(null);
  const [goalBanner, setGoalBanner] = useState<string | null>(null);

  // Separate rosters
  const startersA = rosters.filter((r) => r.team === 'A' && r.is_starter);
  const subsA = rosters.filter((r) => r.team === 'A' && !r.is_starter);
  const startersB = rosters.filter((r) => r.team === 'B' && r.is_starter);
  const subsB = rosters.filter((r) => r.team === 'B' && !r.is_starter);

  // Count goals and assists per player in this match
  const getPlayerMatchStats = (playerId: string) => {
    const goals = events.filter((e) => e.event_type === 'goal' && e.player_id === playerId).length;
    const assists = events.filter((e) => e.event_type === 'goal' && e.assist_player_id === playerId).length;
    const yellowCards = events.filter((e) => e.event_type === 'yellow_card' && e.player_id === playerId).length;
    const redCards = events.filter((e) => e.event_type === 'red_card' && e.player_id === playerId).length;
    return { goals, assists, yellowCards, redCards };
  };

  // Handle clicking on pitch to move player when in move mode
  const handlePitchClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !movingRosterId || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const updated = rosters.map((r) => {
      if (r.id === movingRosterId) {
        return {
          ...r,
          pitch_x: Math.max(4, Math.min(96, x)),
          pitch_y: Math.max(6, Math.min(94, y)),
        };
      }
      return r;
    });

    await onUpdateRosters(updated);
    setMovingRosterId(null);
  };

  // 1-Click Quick Goal Registration (with or without assist)
  const handleQuickGoal = async (
    scorerRoster: MatchRoster,
    assistPlayerId: string | null = null,
    isOwnGoal = false
  ) => {
    if (isSubmittingGoal || readOnly) return;
    setIsSubmittingGoal(true);

    try {
      const scorerPlayer = scorerRoster.player || allPlayers.find((p) => p.id === scorerRoster.player_id);
      const assistPlayer = assistPlayerId ? allPlayers.find((p) => p.id === assistPlayerId) : null;

      // If own goal, score goes to the opposing team
      const scoringTeam: 'A' | 'B' = isOwnGoal
        ? scorerRoster.team === 'A'
          ? 'B'
          : 'A'
        : scorerRoster.team === 'A'
        ? 'A'
        : 'B';

      const newScoreA = scoringTeam === 'A' ? (match.score_a || 0) + 1 : match.score_a || 0;
      const newScoreB = scoringTeam === 'B' ? (match.score_b || 0) + 1 : match.score_b || 0;

      await onAddEvent({
        match_id: match.id,
        team: scoringTeam,
        event_type: isOwnGoal ? 'own_goal' : 'goal',
        player_id: scorerRoster.player_id,
        assist_player_id: isOwnGoal ? null : assistPlayerId,
        minute: match.current_minute || 0,
        period: match.current_period || 1,
        details: isOwnGoal
          ? 'Gol Contra'
          : assistPlayer
          ? `Assistência: ${assistPlayer.nickname || assistPlayer.name}`
          : 'Sem assistência',
      });

      await onUpdateMatchScore(newScoreA, newScoreB);

      confetti({
        particleCount: 75,
        spread: 75,
        origin: { y: 0.6 },
      });

      const scorerName = scorerPlayer?.nickname || scorerPlayer?.name || 'Jogador';
      const assistName = assistPlayer ? ` (👟 Assist: ${assistPlayer.nickname || assistPlayer.name})` : '';
      setGoalBanner(
        isOwnGoal
          ? `⚽ Gol Contra de ${scorerName}! Placar atualizado.`
          : `⚽ GOOOL de ${scorerName}!${assistName}`
      );
      setTimeout(() => setGoalBanner(null), 4500);

      setActiveActionRoster(null);
      setShowSubSelector(false);
    } catch (err) {
      console.error('Error registering quick goal:', err);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // Quick Card Registration
  const handleQuickCard = async (roster: MatchRoster, cardType: 'yellow_card' | 'red_card') => {
    if (isSubmittingGoal || readOnly) return;
    setIsSubmittingGoal(true);
    try {
      await onAddEvent({
        match_id: match.id,
        team: roster.team === 'B' ? 'B' : 'A',
        event_type: cardType,
        player_id: roster.player_id,
        assist_player_id: null,
        minute: match.current_minute || 0,
        period: match.current_period || 1,
      });
      setActiveActionRoster(null);
    } finally {
      setIsSubmittingGoal(false);
    }
  };

  // Quick Substitution on Pitch (swap starter and reserve)
  const handleQuickSubstitution = async (starterRoster: MatchRoster, reserveRoster: MatchRoster) => {
    if (readOnly) return;
    const updated = rosters.map((r) => {
      if (r.id === starterRoster.id) {
        return { ...r, is_starter: false };
      }
      if (r.id === reserveRoster.id) {
        return {
          ...r,
          is_starter: true,
          pitch_x: starterRoster.pitch_x,
          pitch_y: starterRoster.pitch_y,
        };
      }
      return r;
    });

    await onUpdateRosters(updated);
    await onAddEvent({
      match_id: match.id,
      team: starterRoster.team === 'B' ? 'B' : 'A',
      event_type: 'substitution',
      player_id: reserveRoster.player_id,
      assist_player_id: starterRoster.player_id,
      minute: match.current_minute || 0,
      period: match.current_period || 1,
      details: 'Substituição',
    });

    setActiveActionRoster(null);
    setShowSubSelector(false);
  };

  // Delete / Undo Goal Event
  const handleUndoEvent = async (event: MatchEvent) => {
    if (readOnly) return;
    if (event.event_type === 'goal' || event.event_type === 'own_goal') {
      const newScoreA = event.team === 'A' ? Math.max(0, (match.score_a || 0) - 1) : match.score_a || 0;
      const newScoreB = event.team === 'B' ? Math.max(0, (match.score_b || 0) - 1) : match.score_b || 0;
      await onUpdateMatchScore(newScoreA, newScoreB);
    }
    await onDeleteEvent(event.id);
  };

  // Toggle starter / sub
  const toggleStarterStatus = async (rosterId: string) => {
    if (readOnly) return;
    const updated = rosters.map((r) => {
      if (r.id === rosterId) {
        return { ...r, is_starter: !r.is_starter };
      }
      return r;
    });
    await onUpdateRosters(updated);
  };

  // Auto balance teams
  const handleAutoBalance = async () => {
    if (readOnly) return;
    const participatingPlayers = rosters
      .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
      .filter((p): p is Player => Boolean(p));

    const result = balanceTeams(participatingPlayers, match.players_per_team);
    setBalanceNote(result.explanation);

    const newRosters: MatchRoster[] = [];

    result.teamA.forEach((player, idx) => {
      const existing = rosters.find((r) => r.player_id === player.id);
      const isStarter = idx < match.starters_count;
      newRosters.push({
        id: existing?.id || crypto.randomUUID(),
        match_id: match.id,
        player_id: player.id,
        team: 'A',
        is_starter: isStarter,
        position: player.preferred_position,
        pitch_x: 25,
        pitch_y: 50,
        shirt_number: player.shirt_number || idx + 1,
        confirmed_attendance: true,
        player,
      });
    });

    result.teamB.forEach((player, idx) => {
      const existing = rosters.find((r) => r.player_id === player.id);
      const isStarter = idx < match.starters_count;
      newRosters.push({
        id: existing?.id || crypto.randomUUID(),
        match_id: match.id,
        player_id: player.id,
        team: 'B',
        is_starter: isStarter,
        position: player.preferred_position,
        pitch_x: 75,
        pitch_y: 50,
        shirt_number: player.shirt_number || idx + 1,
        confirmed_attendance: true,
        player,
      });
    });

    const positionedA = generateDefaultPitchCoordinates(
      newRosters.filter((r) => r.team === 'A'),
      'A'
    ) as MatchRoster[];
    const positionedB = generateDefaultPitchCoordinates(
      newRosters.filter((r) => r.team === 'B'),
      'B'
    ) as MatchRoster[];

    const finalRosters = [
      ...positionedA,
      ...newRosters.filter((r) => r.team === 'A' && !r.is_starter),
      ...positionedB,
      ...newRosters.filter((r) => r.team === 'B' && !r.is_starter),
    ];

    await onUpdateRosters(finalRosters);
  };

  // Pure random draw
  const handleRandomDraw = async () => {
    if (readOnly) return;
    const participatingPlayers = rosters
      .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
      .filter((p): p is Player => Boolean(p));

    const result = drawRandomTeams(participatingPlayers, match.players_per_team);
    setBalanceNote(result.explanation);

    const newRosters: MatchRoster[] = [];

    result.teamA.forEach((player, idx) => {
      const existing = rosters.find((r) => r.player_id === player.id);
      newRosters.push({
        id: existing?.id || crypto.randomUUID(),
        match_id: match.id,
        player_id: player.id,
        team: 'A',
        is_starter: idx < match.starters_count,
        position: player.preferred_position,
        pitch_x: 25,
        pitch_y: 50,
        shirt_number: player.shirt_number || idx + 1,
        confirmed_attendance: true,
        player,
      });
    });

    result.teamB.forEach((player, idx) => {
      const existing = rosters.find((r) => r.player_id === player.id);
      newRosters.push({
        id: existing?.id || crypto.randomUUID(),
        match_id: match.id,
        player_id: player.id,
        team: 'B',
        is_starter: idx < match.starters_count,
        position: player.preferred_position,
        pitch_x: 75,
        pitch_y: 50,
        shirt_number: player.shirt_number || idx + 1,
        confirmed_attendance: true,
        player,
      });
    });

    const positionedA = generateDefaultPitchCoordinates(
      newRosters.filter((r) => r.team === 'A'),
      'A'
    ) as MatchRoster[];
    const positionedB = generateDefaultPitchCoordinates(
      newRosters.filter((r) => r.team === 'B'),
      'B'
    ) as MatchRoster[];

    await onUpdateRosters([
      ...positionedA,
      ...newRosters.filter((r) => r.team === 'A' && !r.is_starter),
      ...positionedB,
      ...newRosters.filter((r) => r.team === 'B' && !r.is_starter),
    ]);
  };

  // Export tactical image
  const handleExportImage = async () => {
    if (!pitchRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(pitchRef.current, { quality: 0.95 });
      const link = document.createElement('a');
      link.download = `escalacao-${match.title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export pitch image', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const textA = startersA
      .map((r) => {
        const p = r.player || allPlayers.find((pl) => pl.id === r.player_id);
        return `• ${p?.nickname || p?.name} (${r.position})`;
      })
      .join('\n');
    const textB = startersB
      .map((r) => {
        const p = r.player || allPlayers.find((pl) => pl.id === r.player_id);
        return `• ${p?.nickname || p?.name} (${r.position})`;
      })
      .join('\n');
    const msg =
      `⚽ *ESCALAÇÃO: ${match.title}*\n` +
      `🏆 *Placar:* ${match.team_a_name} ${match.score_a} x ${match.score_b} ${match.team_b_name}\n\n` +
      `📅 *Data:* ${new Date(match.match_date).toLocaleDateString('pt-BR')}\n` +
      `📍 *Local:* ${match.location || 'A definir'}\n\n` +
      `⚪ *${match.team_a_name} (${startersA.length} titulares):*\n${textA}\n\n` +
      `⚫ *${match.team_b_name} (${startersB.length} titulares):*\n${textB}\n\n` +
      `Acompanhe ao vivo pelo FutAmigos!`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Helper to get teammates of the active clicked player for 1-click assist
  const activePlayerObj = activeActionRoster
    ? activeActionRoster.player || allPlayers.find((p) => p.id === activeActionRoster.player_id)
    : null;

  const activeTeammates = activeActionRoster
    ? rosters
        .filter((r) => r.team === activeActionRoster.team && r.player_id !== activeActionRoster.player_id)
        .map((r) => ({
          roster: r,
          player: r.player || allPlayers.find((p) => p.id === r.player_id),
        }))
        .filter((item): item is { roster: MatchRoster; player: Player } => Boolean(item.player))
    : [];

  const activeReserves = activeActionRoster
    ? rosters
        .filter((r) => r.team === activeActionRoster.team && !r.is_starter)
        .map((r) => ({
          roster: r,
          player: r.player || allPlayers.find((p) => p.id === r.player_id),
        }))
        .filter((item): item is { roster: MatchRoster; player: Player } => Boolean(item.player))
    : [];

  const goalEvents = events.filter((e) => e.event_type === 'goal' || e.event_type === 'own_goal');

  const isPdfUrl = (url?: string | null) =>
    Boolean(url && (url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf')));

  return (
    <div className="space-y-4">
      {/* Live Scoreboard + Tactical Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xl space-y-3">
        {/* Compact Live Scoreboard */}
        <div className="flex items-center justify-between bg-slate-950/90 border border-slate-800/80 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-4 h-4 rounded-full ring-2 ring-white/40 shrink-0"
              style={{ backgroundColor: match.team_a_color || '#FFFFFF' }}
            />
            <span className="font-black text-xs sm:text-sm text-white truncate">
              {match.team_a_name}
            </span>
          </div>

          <div className="flex items-center gap-3 px-4 py-1 rounded-xl bg-slate-900 border border-slate-800 mx-2">
            <span className="text-2xl sm:text-3xl font-black text-white">{match.score_a || 0}</span>
            <span className="text-xs font-bold text-emerald-400 uppercase">×</span>
            <span className="text-2xl sm:text-3xl font-black text-white">{match.score_b || 0}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right">
            <span className="font-black text-xs sm:text-sm text-white truncate">
              {match.team_b_name}
            </span>
            <div
              className="w-4 h-4 rounded-full ring-2 ring-white/40 shrink-0"
              style={{ backgroundColor: match.team_b_color || '#1E293B' }}
            />
          </div>
        </div>

        {/* Instruction Tip + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span>⚽</span>
              <span>Toque no jogador em campo para registrar Gol e Assistência!</span>
            </span>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleAutoBalance}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 transition"
                title="Equilibrar habilidades e posições"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Equilibrar</span>
              </button>
              <button
                onClick={handleRandomDraw}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition"
                title="Sorteio aleatório"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Sortear</span>
              </button>
              <button
                onClick={handleExportImage}
                disabled={isExporting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition"
                title="Baixar imagem da escalação"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Gerando...' : 'Imagem'}</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition"
                title="Compartilhar no WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Zap</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Goal Celebration Toast Banner */}
      {goalBanner && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-600 to-green-600 rounded-2xl text-white font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <span>{goalBanner}</span>
          </div>
          <button onClick={() => setGoalBanner(null)} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {balanceNote && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{balanceNote}</span>
          </div>
          <button
            onClick={() => setBalanceNote(null)}
            className="text-xs text-slate-400 hover:text-white ml-2"
          >
            ×
          </button>
        </div>
      )}

      {movingRosterId && (
        <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-300 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 font-bold">
            <Move className="w-4 h-4 text-amber-400" />
            <span>Agora toque no ponto do gramado para onde deseja mover o jogador!</span>
          </div>
          <button
            onClick={() => setMovingRosterId(null)}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-bold text-xs"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Virtual Field Container */}
      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl select-none cursor-pointer"
        style={{
          background: 'radial-gradient(ellipse at center, #1b6336 0%, #144927 80%, #0d301a 100%)',
        }}
      >
        {/* Grass Stripes Pattern */}
        <div className="absolute inset-0 opacity-15 pointer-events-none flex">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-full ${i % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
            />
          ))}
        </div>

        {/* Pitch Lines */}
        <div className="absolute inset-3 border-2 border-white/60 pointer-events-none rounded-sm">
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r-2 border-white/60"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 border-2 border-white/60 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>

          {/* Goal Area Left (Team A) */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-14 sm:w-20 h-28 sm:h-36 border-2 border-l-0 border-white/60"></div>
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-6 sm:w-9 h-14 sm:h-20 border-2 border-l-0 border-white/60"></div>

          {/* Goal Area Right (Team B) */}
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-14 sm:w-20 h-28 sm:h-36 border-2 border-r-0 border-white/60"></div>
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-6 sm:w-9 h-14 sm:h-20 border-2 border-r-0 border-white/60"></div>
        </div>

        {/* Team Badges & Headers on Pitch */}
        <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none z-10">
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/50"
            style={{ backgroundColor: match.team_a_color || '#FFFFFF' }}
          />
          <span className="text-xs sm:text-sm font-black text-white/90 drop-shadow">
            {match.team_a_name} ({match.score_a || 0})
          </span>
        </div>

        <div className="absolute top-4 right-6 flex items-center gap-2 pointer-events-none z-10">
          <span className="text-xs sm:text-sm font-black text-white/90 drop-shadow">
            ({match.score_b || 0}) {match.team_b_name}
          </span>
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/50"
            style={{ backgroundColor: match.team_b_color || '#1E293B' }}
          />
        </div>

        {/* Starters Rendered on Pitch */}
        {[...startersA, ...startersB].map((roster) => {
          const isA = roster.team === 'A';
          const isMoving = movingRosterId === roster.id;
          const player = roster.player || allPlayers.find((p) => p.id === roster.player_id);
          const teamColor = isA ? match.team_a_color || '#FFFFFF' : match.team_b_color || '#1E293B';
          const isLightTeam = isA && teamColor.toUpperCase() === '#FFFFFF';
          const stats = getPlayerMatchStats(roster.player_id);

          return (
            <div
              key={roster.id}
              onClick={(e) => {
                e.stopPropagation();
                if (readOnly) return;
                if (movingRosterId) {
                  setMovingRosterId(null);
                  return;
                }
                setActiveActionRoster(roster);
                setShowSubSelector(false);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform cursor-pointer ${
                isMoving ? 'scale-125 z-30' : 'hover:scale-115 active:scale-95 z-20'
              }`}
              style={{
                left: `${roster.pitch_x || (isA ? 25 : 75)}%`,
                top: `${roster.pitch_y || 50}%`,
              }}
            >
              {/* Player Icon / Avatar */}
              <div
                className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xl ring-2 transition ${
                  isMoving
                    ? 'ring-amber-400 ring-offset-2 ring-offset-slate-900 animate-bounce'
                    : 'ring-white/90 group-hover:ring-emerald-400'
                }`}
                style={{
                  backgroundColor: teamColor,
                  color: isLightTeam ? '#0f172a' : '#ffffff',
                }}
              >
                {player?.photo_url && !isPdfUrl(player.photo_url) ? (
                  <img
                    src={player.photo_url}
                    alt={player.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{roster.shirt_number || player?.shirt_number || (isA ? 'A' : 'B')}</span>
                )}

                {/* Goals badge on player */}
                {stats.goals > 0 && (
                  <div className="absolute -top-2 -left-2 bg-emerald-500 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full border border-white shadow-md flex items-center gap-0.5">
                    <span>⚽</span>
                    {stats.goals > 1 && <span>{stats.goals}</span>}
                  </div>
                )}

                {/* Assists badge on player */}
                {stats.assists > 0 && (
                  <div className="absolute -bottom-1.5 -right-2 bg-sky-500 text-slate-950 font-black text-[9px] px-1 rounded-full border border-white shadow">
                    👟{stats.assists > 1 ? stats.assists : ''}
                  </div>
                )}

                {/* Cards badge */}
                {(stats.yellowCards > 0 || stats.redCards > 0) && (
                  <div
                    className={`absolute -top-1.5 -right-1.5 w-3 h-4 rounded-xs border border-white shadow ${
                      stats.redCards > 0 ? 'bg-rose-600' : 'bg-amber-400'
                    }`}
                  />
                )}
              </div>

              {/* Player Name Tag */}
              <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-950/90 backdrop-blur-sm border border-slate-800 text-[10px] sm:text-xs font-bold text-white shadow max-w-[90px] sm:max-w-[115px] truncate text-center group-hover:border-emerald-500/60 transition">
                {player?.nickname || player?.name || 'Jogador'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Goals Ticker right below the pitch */}
      {goalEvents.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚽ Gols da Partida ({goalEvents.length})</span>
            </span>
            <span className="text-[10px] text-slate-500">Toque na lixeira para desfazer um gol</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {goalEvents.map((ev) => {
              const scorer = allPlayers.find((p) => p.id === ev.player_id);
              const assistant = allPlayers.find((p) => p.id === ev.assist_player_id);
              const isTeamA = ev.team === 'A';
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: isTeamA
                        ? match.team_a_color || '#FFFFFF'
                        : match.team_b_color || '#1E293B',
                    }}
                  />
                  <span className="font-bold text-white">
                    ⚽ {scorer?.nickname || scorer?.name || 'Gol'}
                  </span>
                  {ev.event_type === 'own_goal' ? (
                    <span className="text-[10px] text-rose-400 font-bold">(Contra)</span>
                  ) : assistant ? (
                    <span className="text-[11px] text-sky-400">
                      (👟 {assistant.nickname || assistant.name})
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">(Sem assist.)</span>
                  )}
                  {!readOnly && (
                    <button
                      onClick={() => handleUndoEvent(ev)}
                      className="text-slate-500 hover:text-rose-400 ml-1 p-0.5"
                      title="Desfazer gol"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Starters & Substitutes Bench Bins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A Benches */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full ring-1 ring-slate-700"
                style={{ backgroundColor: match.team_a_color || '#FFFFFF' }}
              />
              <h3 className="font-bold text-sm text-white">{match.team_a_name}</h3>
            </div>
            <span className="text-xs text-slate-400">
              {startersA.length} titulares • {subsA.length} reservas
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Titulares no Campo (Toque para registrar Gol)
            </span>
            <div className="flex flex-wrap gap-2">
              {startersA.map((r) => {
                const player = r.player || allPlayers.find((p) => p.id === r.player_id);
                const stats = getPlayerMatchStats(r.player_id);
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (!readOnly) {
                        setActiveActionRoster(r);
                        setShowSubSelector(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-xs cursor-pointer transition"
                  >
                    <span className="font-bold text-emerald-400">#{r.shirt_number || '1'}</span>
                    <span className="text-slate-200 font-semibold">
                      {player?.nickname || player?.name}
                    </span>
                    {stats.goals > 0 && <span className="text-emerald-400 font-bold">⚽{stats.goals}</span>}
                    {stats.assists > 0 && <span className="text-sky-400 font-bold">👟{stats.assists}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {subsA.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Banco de Reservas
              </span>
              <div className="flex flex-wrap gap-2">
                {subsA.map((r) => {
                  const player = r.player || allPlayers.find((p) => p.id === r.player_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400"
                    >
                      <span>{player?.nickname || player?.name}</span>
                      {!readOnly && (
                        <>
                          <button
                            onClick={() => {
                              setActiveActionRoster(r);
                              setShowSubSelector(false);
                            }}
                            className="text-[10px] text-emerald-400 hover:underline ml-1 font-bold"
                          >
                            +Gol
                          </button>
                          <button
                            onClick={() => toggleStarterStatus(r.id)}
                            className="text-[10px] text-sky-400 hover:underline ml-1 font-semibold"
                          >
                            (Escalar)
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Team B Benches */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full ring-1 ring-slate-700"
                style={{ backgroundColor: match.team_b_color || '#1E293B' }}
              />
              <h3 className="font-bold text-sm text-white">{match.team_b_name}</h3>
            </div>
            <span className="text-xs text-slate-400">
              {startersB.length} titulares • {subsB.length} reservas
            </span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Titulares no Campo (Toque para registrar Gol)
            </span>
            <div className="flex flex-wrap gap-2">
              {startersB.map((r) => {
                const player = r.player || allPlayers.find((p) => p.id === r.player_id);
                const stats = getPlayerMatchStats(r.player_id);
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (!readOnly) {
                        setActiveActionRoster(r);
                        setShowSubSelector(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-xs cursor-pointer transition"
                  >
                    <span className="font-bold text-emerald-400">#{r.shirt_number || '1'}</span>
                    <span className="text-slate-200 font-semibold">
                      {player?.nickname || player?.name}
                    </span>
                    {stats.goals > 0 && <span className="text-emerald-400 font-bold">⚽{stats.goals}</span>}
                    {stats.assists > 0 && <span className="text-sky-400 font-bold">👟{stats.assists}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {subsB.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Banco de Reservas
              </span>
              <div className="flex flex-wrap gap-2">
                {subsB.map((r) => {
                  const player = r.player || allPlayers.find((p) => p.id === r.player_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400"
                    >
                      <span>{player?.nickname || player?.name}</span>
                      {!readOnly && (
                        <>
                          <button
                            onClick={() => {
                              setActiveActionRoster(r);
                              setShowSubSelector(false);
                            }}
                            className="text-[10px] text-emerald-400 hover:underline ml-1 font-bold"
                          >
                            +Gol
                          </button>
                          <button
                            onClick={() => toggleStarterStatus(r.id)}
                            className="text-[10px] text-sky-400 hover:underline ml-1 font-semibold"
                          >
                            (Escalar)
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* ULTRA-FAST QUICK GOAL & ASSIST POPOVER MODAL                      */}
      {/* ================================================================= */}
      {activeActionRoster && activePlayerObj && (
        <div
          onClick={() => setActiveActionRoster(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveActionRoster(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Clicked Player Header */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {activePlayerObj.photo_url && !isPdfUrl(activePlayerObj.photo_url) ? (
                  <img
                    src={activePlayerObj.photo_url}
                    alt={activePlayerObj.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-black text-emerald-400">
                    #{activeActionRoster.shirt_number || activePlayerObj.shirt_number || '10'}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase">
                    {activeActionRoster.team === 'A' ? match.team_a_name : match.team_b_name}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {activeActionRoster.position}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {activePlayerObj.nickname || activePlayerObj.name}
                </h3>
              </div>
            </div>

            {!showSubSelector ? (
              <>
                {/* 1-TAP SOLO GOAL BUTTON */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      ⚽ Registrar Gol de {activePlayerObj.nickname || activePlayerObj.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmittingGoal}
                    onClick={() => handleQuickGoal(activeActionRoster, null, false)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-sm shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>GOL SEM ASSISTÊNCIA (1 TOQUE)</span>
                  </button>
                </div>

                {/* 1-TAP ASSIST SELECTION GRID */}
                {activeTeammates.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-bold text-slate-300 block">
                      👟 Ou toque em quem deu a Assistência (já salva o gol na hora):
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                      {activeTeammates.map(({ roster: tmRoster, player: tmPlayer }) => (
                        <button
                          key={tmRoster.id}
                          type="button"
                          disabled={isSubmittingGoal}
                          onClick={() => handleQuickGoal(activeActionRoster, tmPlayer.id, false)}
                          className="flex items-center gap-2 p-2 rounded-2xl bg-slate-800/90 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-500 text-left transition active:scale-95 group"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0 ring-1 ring-slate-600 group-hover:ring-emerald-400">
                            {tmPlayer.photo_url && !isPdfUrl(tmPlayer.photo_url) ? (
                              <img
                                src={tmPlayer.photo_url}
                                alt={tmPlayer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-emerald-400 text-[11px]">
                                #{tmRoster.shirt_number || tmPlayer.shirt_number || '•'}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-white block truncate group-hover:text-emerald-300">
                              {tmPlayer.nickname || tmPlayer.name.split(' ')[0]}
                            </span>
                            <span className="text-[9px] text-slate-400 block truncate">
                              👟 Deu o passe
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Secondary Quick Actions (Move, Sub, Cards, Own Goal) */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Outras Ações Rápidas do Jogador
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {activeActionRoster.is_starter && (
                      <button
                        type="button"
                        onClick={() => {
                          setMovingRosterId(activeActionRoster.id);
                          setActiveActionRoster(null);
                        }}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition"
                      >
                        <Move className="w-3.5 h-3.5" />
                        <span>Mover no Campo</span>
                      </button>
                    )}

                    {activeActionRoster.is_starter && activeReserves.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSubSelector(true)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Substituir</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingGoal}
                      onClick={() => handleQuickCard(activeActionRoster, 'yellow_card')}
                      className="py-2 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                    >
                      <span className="w-2.5 h-3.5 rounded-xs bg-amber-400 inline-block" />
                      <span>Amarelo</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingGoal}
                      onClick={() => handleQuickCard(activeActionRoster, 'red_card')}
                      className="py-2 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                    >
                      <span className="w-2.5 h-3.5 rounded-xs bg-rose-600 inline-block" />
                      <span>Vermelho</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingGoal}
                      onClick={() => handleQuickGoal(activeActionRoster, null, true)}
                      className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-rose-400 border border-slate-700 text-[11px] font-bold transition"
                    >
                      ⚽ Gol Contra
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Substitution Selector View */
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">
                    🔄 Quem entra no lugar de {activePlayerObj.nickname || activePlayerObj.name}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSubSelector(false)}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Voltar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {activeReserves.map(({ roster: resRoster, player: resPlayer }) => (
                    <button
                      key={resRoster.id}
                      type="button"
                      onClick={() => handleQuickSubstitution(activeActionRoster, resRoster)}
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-800 hover:bg-sky-950/50 border border-slate-700 hover:border-sky-500 text-left transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-sky-400">
                          #{resRoster.shirt_number || resPlayer.shirt_number || 'R'}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {resPlayer.nickname || resPlayer.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {resPlayer.preferred_position}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-sky-400">Colocar em Campo →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
