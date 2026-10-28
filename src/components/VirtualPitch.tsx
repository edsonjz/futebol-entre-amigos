import React, { useState, useRef } from 'react';
import { Player, MatchRoster, Match } from '../types/database';
import { toPng } from 'html-to-image';
import {
  Shuffle,
  Scale,
  Download,
  Share2,
  Users,
  Shirt,
  Info,
  CheckCircle2,
  PlusCircle,
  Move
} from 'lucide-react';
import { balanceTeams, drawRandomTeams, generateDefaultPitchCoordinates } from '../lib/teamBalancer';

interface VirtualPitchProps {
  match: Match;
  rosters: MatchRoster[];
  allPlayers: Player[];
  onUpdateRosters: (newRosters: MatchRoster[]) => Promise<void>;
  readOnly?: boolean;
}

export const VirtualPitch: React.FC<VirtualPitchProps> = ({
  match,
  rosters,
  allPlayers,
  onUpdateRosters,
  readOnly = false,
}) => {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [balanceNote, setBalanceNote] = useState<string | null>(null);

  // Separate rosters
  const startersA = rosters.filter(r => r.team === 'A' && r.is_starter);
  const subsA = rosters.filter(r => r.team === 'A' && !r.is_starter);
  const startersB = rosters.filter(r => r.team === 'B' && r.is_starter);
  const subsB = rosters.filter(r => r.team === 'B' && !r.is_starter);
  const unassigned = rosters.filter(r => r.team === 'UNASSIGNED');

  // Handle clicking on pitch to move selected player
  const handlePitchClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !selectedRosterId || !pitchRef.current) return;

    const rect = pitchRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const updated = rosters.map(r => {
      if (r.id === selectedRosterId) {
        return {
          ...r,
          pitch_x: Math.max(3, Math.min(97, x)),
          pitch_y: Math.max(5, Math.min(95, y)),
        };
      }
      return r;
    });

    await onUpdateRosters(updated);
    setSelectedRosterId(null);
  };

  // Toggle starter / sub
  const toggleStarterStatus = async (rosterId: string) => {
    if (readOnly) return;
    const updated = rosters.map(r => {
      if (r.id === rosterId) {
        return { ...r, is_starter: !r.is_starter };
      }
      return r;
    });
    await onUpdateRosters(updated);
  };

  // Change team assignment
  const changePlayerTeam = async (rosterId: string, newTeam: 'A' | 'B' | 'UNASSIGNED') => {
    if (readOnly) return;
    const roster = rosters.find(r => r.id === rosterId);
    if (!roster) return;

    let updated = rosters.map(r => {
      if (r.id === rosterId) {
        return {
          ...r,
          team: newTeam,
          pitch_x: newTeam === 'A' ? 25 : newTeam === 'B' ? 75 : 50,
          pitch_y: 50,
        };
      }
      return r;
    });

    await onUpdateRosters(updated);
  };

  // Auto balance teams
  const handleAutoBalance = async () => {
    if (readOnly) return;
    const participatingPlayers = rosters
      .map(r => r.player || allPlayers.find(p => p.id === r.player_id))
      .filter((p): p is Player => Boolean(p));

    const result = balanceTeams(participatingPlayers, match.players_per_team);
    setBalanceNote(result.explanation);

    // Map to rosters with default tactical coordinates
    const newRosters: MatchRoster[] = [];

    // Team A
    result.teamA.forEach((player, idx) => {
      const existing = rosters.find(r => r.player_id === player.id);
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

    // Team B
    result.teamB.forEach((player, idx) => {
      const existing = rosters.find(r => r.player_id === player.id);
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

    // Position coordinates
    const positionedA = generateDefaultPitchCoordinates(newRosters.filter(r => r.team === 'A'), 'A') as MatchRoster[];
    const positionedB = generateDefaultPitchCoordinates(newRosters.filter(r => r.team === 'B'), 'B') as MatchRoster[];

    const finalRosters = [
      ...positionedA,
      ...newRosters.filter(r => r.team === 'A' && !r.is_starter),
      ...positionedB,
      ...newRosters.filter(r => r.team === 'B' && !r.is_starter),
    ];

    await onUpdateRosters(finalRosters);
  };

  // Pure random draw
  const handleRandomDraw = async () => {
    if (readOnly) return;
    const participatingPlayers = rosters
      .map(r => r.player || allPlayers.find(p => p.id === r.player_id))
      .filter((p): p is Player => Boolean(p));

    const result = drawRandomTeams(participatingPlayers, match.players_per_team);
    setBalanceNote(result.explanation);

    const newRosters: MatchRoster[] = [];

    result.teamA.forEach((player, idx) => {
      const existing = rosters.find(r => r.player_id === player.id);
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
      const existing = rosters.find(r => r.player_id === player.id);
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

    const positionedA = generateDefaultPitchCoordinates(newRosters.filter(r => r.team === 'A'), 'A') as MatchRoster[];
    const positionedB = generateDefaultPitchCoordinates(newRosters.filter(r => r.team === 'B'), 'B') as MatchRoster[];

    await onUpdateRosters([
      ...positionedA,
      ...newRosters.filter(r => r.team === 'A' && !r.is_starter),
      ...positionedB,
      ...newRosters.filter(r => r.team === 'B' && !r.is_starter),
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
    const textA = startersA.map(r => `• ${r.player?.nickname || r.player?.name} (${r.position})`).join('\n');
    const textB = startersB.map(r => `• ${r.player?.nickname || r.player?.name} (${r.position})`).join('\n');
    const msg = `⚽ *ESCALAÇÃO: ${match.title}*\n\n` +
      `📅 *Data:* ${new Date(match.match_date).toLocaleDateString('pt-BR')}\n` +
      `📍 *Local:* ${match.location || 'A definir'}\n\n` +
      `⚪ *${match.team_a_name} (${startersA.length} titulares):*\n${textA}\n\n` +
      `⚫ *${match.team_b_name} (${startersB.length} titulares):*\n${textB}\n\n` +
      `Acompanhe ao vivo pelo FutAmigos!`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60 uppercase">
            {match.modality} • {match.players_per_team}x{match.players_per_team}
          </span>
          <span className="text-xs text-slate-400">
            {startersA.length + startersB.length} titulares em campo
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

      {selectedRosterId && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Toque em qualquer lugar do campo para posicionar o jogador selecionado.</span>
          </div>
          <button
            onClick={() => setSelectedRosterId(null)}
            className="text-amber-400 hover:underline font-bold text-xs"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Virtual Field Container */}
      <div
        ref={pitchRef}
        onClick={handlePitchClick}
        className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl select-none cursor-pointer"
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
          {/* Halfway Line */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r-2 border-white/60"></div>
          {/* Center Circle */}
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
            {match.team_a_name}
          </span>
        </div>

        <div className="absolute top-4 right-6 flex items-center gap-2 pointer-events-none z-10">
          <span className="text-xs sm:text-sm font-black text-white/90 drop-shadow">
            {match.team_b_name}
          </span>
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/50"
            style={{ backgroundColor: match.team_b_color || '#1E293B' }}
          />
        </div>

        {/* Starters Rendered on Pitch */}
        {[...startersA, ...startersB].map((roster) => {
          const isA = roster.team === 'A';
          const isSelected = selectedRosterId === roster.id;
          const player = roster.player || allPlayers.find(p => p.id === roster.player_id);
          const teamColor = isA ? match.team_a_color || '#FFFFFF' : match.team_b_color || '#1E293B';
          const isLightTeam = isA && teamColor.toUpperCase() === '#FFFFFF';

          return (
            <div
              key={roster.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!readOnly) {
                  setSelectedRosterId(isSelected ? null : roster.id);
                }
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform ${
                isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-20'
              }`}
              style={{
                left: `${roster.pitch_x || (isA ? 25 : 75)}%`,
                top: `${roster.pitch_y || 50}%`,
              }}
            >
              {/* Player Icon / Avatar */}
              <div
                className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xl ring-2 transition ${
                  isSelected
                    ? 'ring-amber-400 ring-offset-2 ring-offset-slate-900 animate-bounce'
                    : 'ring-white/80'
                }`}
                style={{
                  backgroundColor: teamColor,
                  color: isLightTeam ? '#0f172a' : '#ffffff',
                }}
              >
                {player?.photo_url ? (
                  <img
                    src={player.photo_url}
                    alt={player.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{roster.shirt_number || player?.shirt_number || (isA ? 'A' : 'B')}</span>
                )}

                {/* Rating badge */}
                <div className="absolute -top-1.5 -right-1.5 bg-slate-950/90 text-emerald-400 font-extrabold text-[9px] px-1 py-0.2 rounded-full border border-slate-700 shadow">
                  {player?.base_rating || '6.5'}
                </div>
              </div>

              {/* Player Name Tag */}
              <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-950/85 backdrop-blur-sm border border-slate-800 text-[10px] sm:text-xs font-bold text-white shadow max-w-[85px] sm:max-w-[110px] truncate text-center pointer-events-none">
                {player?.nickname || player?.name || 'Jogador'}
              </div>
            </div>
          );
        })}
      </div>

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
              Titulares no Campo
            </span>
            <div className="flex flex-wrap gap-2">
              {startersA.map((r) => {
                const player = r.player || allPlayers.find(p => p.id === r.player_id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs"
                  >
                    <span className="font-bold text-emerald-400">#{r.shirt_number || '1'}</span>
                    <span className="text-slate-200">{player?.nickname || player?.name}</span>
                    {!readOnly && (
                      <button
                        onClick={() => toggleStarterStatus(r.id)}
                        className="text-[10px] text-amber-400 hover:underline ml-1 font-semibold"
                        title="Mover para reserva"
                      >
                        (Reserva)
                      </button>
                    )}
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
                  const player = r.player || allPlayers.find(p => p.id === r.player_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400"
                    >
                      <span>{player?.nickname || player?.name}</span>
                      {!readOnly && (
                        <button
                          onClick={() => toggleStarterStatus(r.id)}
                          className="text-[10px] text-emerald-400 hover:underline ml-1 font-semibold"
                          title="Mover para titular"
                        >
                          (Escalar)
                        </button>
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
              Titulares no Campo
            </span>
            <div className="flex flex-wrap gap-2">
              {startersB.map((r) => {
                const player = r.player || allPlayers.find(p => p.id === r.player_id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs"
                  >
                    <span className="font-bold text-emerald-400">#{r.shirt_number || '1'}</span>
                    <span className="text-slate-200">{player?.nickname || player?.name}</span>
                    {!readOnly && (
                      <button
                        onClick={() => toggleStarterStatus(r.id)}
                        className="text-[10px] text-amber-400 hover:underline ml-1 font-semibold"
                        title="Mover para reserva"
                      >
                        (Reserva)
                      </button>
                    )}
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
                  const player = r.player || allPlayers.find(p => p.id === r.player_id);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400"
                    >
                      <span>{player?.nickname || player?.name}</span>
                      {!readOnly && (
                        <button
                          onClick={() => toggleStarterStatus(r.id)}
                          className="text-[10px] text-emerald-400 hover:underline ml-1 font-semibold"
                          title="Mover para titular"
                        >
                          (Escalar)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
