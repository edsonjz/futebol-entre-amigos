import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './context/AuthContext';
import {
  Player,
  Match,
  MatchRoster,
  MatchEvent,
  PlayerRating,
  PlayerStats,
  Group
} from './types/database';
import { calculatePlayerStats } from './lib/statsCalculator';
import { Navbar } from './components/Navbar';
import { BottomNav, NavTab } from './components/BottomNav';
import { VirtualPitch } from './components/VirtualPitch';
import { MatchLiveCenter } from './components/MatchLiveCenter';
import { MatchRatingModal } from './components/MatchRatingModal';
import { RankingsView } from './components/RankingsView';
import { PlayerModal } from './components/PlayerModal';
import { MatchCreatorModal } from './components/MatchCreatorModal';
import { FinancesModal } from './components/FinancesModal';
import { GroupSettingsModal } from './components/GroupSettingsModal';
import { PollsView } from './components/PollsView';
import { ProfileModal } from './components/ProfileModal';
import { MatchMvpPollBanner } from './components/MatchMvpPollBanner';
import {

  Calendar,
  Users,
  Trophy,
  Plus,
  Play,
  Award,
  Sparkles,
  ArrowRight,
  DollarSign,
  Star,
  CheckCircle,
  Clock,
  Shield,
  Activity,
  UserCheck,
  Trash2
} from 'lucide-react';

export const App: React.FC = () => {
  const { currentGroup, user, isAdmin, setCurrentGroup, ensureGroup } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('matches');


  // Main Entities State
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [rosters, setRosters] = useState<MatchRoster[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active match sub-view: 'pitch' | 'live'
  const [matchViewMode, setMatchViewMode] = useState<'pitch' | 'live'>('pitch');

  // Modals state
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showFinancesModal, setShowFinancesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Linked player for current user
  const myPlayer = players.find((p) => p.user_id === user?.id) || null;


  // Fetch initial group data
  const fetchData = async () => {
    if (!currentGroup?.id) return;
    setIsLoading(true);

    try {
      // 1. Fetch Players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('group_id', currentGroup.id)
        .order('name', { ascending: true });

      if (playersData) {
        setPlayers(playersData as Player[]);
      }

      // 2. Fetch Matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('group_id', currentGroup.id)
        .order('match_date', { ascending: false });

      if (matchesData && matchesData.length > 0) {
        setMatches(matchesData as Match[]);
        // Select ongoing or first match as active
        const ongoing = matchesData.find((m) => m.status === 'in_progress' || m.status === 'ready');
        setActiveMatch((ongoing || matchesData[0]) as Match);
      } else {
        setMatches([]);
        setActiveMatch(null);
      }

      // 3. Fetch Ratings
      const { data: ratingsData } = await supabase.from('player_ratings').select('*');
      if (ratingsData) {
        setRatings(ratingsData as PlayerRating[]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Rosters and Events for Active Match
  const fetchActiveMatchDetails = async (matchId: string) => {
    try {
      // Rosters
      const { data: rostersData } = await supabase
        .from('match_rosters')
        .select('*')
        .eq('match_id', matchId);

      if (rostersData) {
        setRosters(rostersData as MatchRoster[]);
      }

      // Events
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', matchId)
        .order('minute', { ascending: true });

      if (eventsData) {
        setEvents(eventsData as MatchEvent[]);
      }
    } catch (err) {
      console.error('Error fetching match details:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentGroup?.id]);

  useEffect(() => {
    if (activeMatch?.id) {
      fetchActiveMatchDetails(activeMatch.id);
    }
  }, [activeMatch?.id]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!activeMatch?.id) return;

    const channelName = `match-realtime-${activeMatch.id}-${Math.random().toString(36).slice(2, 8)}`;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${activeMatch.id}` },
          (payload) => {
            if (payload.new) {
              setActiveMatch(payload.new as Match);
              setMatches((prev) => prev.map((m) => (m.id === activeMatch.id ? (payload.new as Match) : m)));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_rosters', filter: `match_id=eq.${activeMatch.id}` },
          () => {
            fetchActiveMatchDetails(activeMatch.id);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${activeMatch.id}` },
          () => {
            fetchActiveMatchDetails(activeMatch.id);
          }
        )
        .subscribe();
    } catch (err) {
      console.error('Match realtime setup error:', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [activeMatch?.id]);

  // Calculated Stats
  const playerStats: PlayerStats[] = calculatePlayerStats(
    players,
    matches,
    rosters,
    events,
    ratings,
    currentGroup?.settings
  );

  // Quick Seed Roster if 0 players exist
  const handleSeedRoster = async () => {
    const grp = await ensureGroup();
    if (!grp?.id) return;
    setIsLoading(true);

    const initialPlayers = [
      { name: 'Lucas Silva', nickname: 'Lucas', preferred_position: 'Goleiro', base_rating: 8.2, shirt_number: 1 },
      { name: 'Danilo Alcantara', nickname: 'Danilo', preferred_position: 'Goleiro', base_rating: 7.9, shirt_number: 12 },
      { name: 'Rodrigo Santos', nickname: 'Rodrigo', preferred_position: 'Zagueiro', base_rating: 7.8, shirt_number: 3 },
      { name: 'Matheus Costa', nickname: 'Theus', preferred_position: 'Zagueiro', base_rating: 7.5, shirt_number: 4 },
      { name: 'Gabriel Ferreira', nickname: 'Gabi', preferred_position: 'Lateral', base_rating: 7.6, shirt_number: 2 },
      { name: 'Felipe Rocha', nickname: 'Felipinho', preferred_position: 'Lateral', base_rating: 7.4, shirt_number: 6 },
      { name: 'Thiago Mendes', nickname: 'Thiagão', preferred_position: 'Meio-campo', base_rating: 8.5, shirt_number: 8 },
      { name: 'Rafael Oliveira', nickname: 'Rafa', preferred_position: 'Meio-campo', base_rating: 8.0, shirt_number: 5 },
      { name: 'Bruno Souza', nickname: 'Bruninho', preferred_position: 'Meio-campo', base_rating: 7.7, shirt_number: 7 },
      { name: 'Vitor Hugo', nickname: 'Vitinho', preferred_position: 'Meio-campo', base_rating: 7.3, shirt_number: 11 },
      { name: 'Eduardo Lima', nickname: 'Dudu', preferred_position: 'Atacante', base_rating: 8.7, shirt_number: 9 },
      { name: 'Leandro Pereira', nickname: 'Léo', preferred_position: 'Atacante', base_rating: 8.3, shirt_number: 10 },
      { name: 'Gustavo Borges', nickname: 'Guto', preferred_position: 'Atacante', base_rating: 7.6, shirt_number: 19 },
      { name: 'Caio Martins', nickname: 'Caio', preferred_position: 'Lateral', base_rating: 7.2, shirt_number: 14 },
    ];

    try {
      const inserts = initialPlayers.map((p) => ({
        ...p,
        group_id: grp.id,
        dominant_foot: 'Destro',
        is_active: true,
      }));

      const { data, error } = await supabase.from('players').insert(inserts).select();
      if (!error && data) {
        setPlayers(data as Player[]);
      }
    } catch (err) {
      console.error('Error seeding players:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Save or Update Player
  const handleSavePlayer = async (playerData: Partial<Player>): Promise<Player | null> => {
    const grp = await ensureGroup();
    if (!grp?.id) {
      throw new Error('Grupo não encontrado. Recarregue a página.');
    }

    if (editingPlayer?.id) {
      const { data, error } = await supabase
        .from('players')
        .update({
          name: playerData.name,
          nickname: playerData.nickname,
          photo_url: playerData.photo_url,
          preferred_position: playerData.preferred_position,
          dominant_foot: playerData.dominant_foot,
          base_rating: playerData.base_rating,
          shirt_number: playerData.shirt_number,
          notes: playerData.notes,
          is_active: playerData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPlayer.id)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const updated = data as Player;
        setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditingPlayer(null);
        return updated;
      }
    } else {
      const { data, error } = await supabase
        .from('players')
        .insert({
          group_id: grp.id,
          name: playerData.name,
          nickname: playerData.nickname,
          photo_url: playerData.photo_url,
          preferred_position: playerData.preferred_position || 'Meio-campo',
          dominant_foot: playerData.dominant_foot || 'Destro',
          base_rating: playerData.base_rating ?? 6.5,
          shirt_number: playerData.shirt_number ?? null,
          notes: playerData.notes ?? null,
          is_active: playerData.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const created = data as Player;
        setPlayers((prev) => [...prev, created]);
        setEditingPlayer(null);
        return created;
      }
    }
    return null;
  };

  // Handler: Create Match
  const handleSaveMatch = async (matchData: Partial<Match>, selectedPlayerIds: string[]) => {
    const grp = await ensureGroup();
    if (!grp?.id) return;

    const { data: newMatch, error } = await supabase
      .from('matches')
      .insert({ ...matchData, group_id: grp.id })
      .select()
      .single();

    if (error || !newMatch) return;


    // Create match rosters
    const rostersToInsert = selectedPlayerIds.map((playerId, index) => {
      const team = index % 2 === 0 ? 'A' : 'B';
      const isStarter = index < (newMatch.starters_count * 2);
      const player = players.find((p) => p.id === playerId);

      return {
        match_id: newMatch.id,
        player_id: playerId,
        team,
        is_starter: isStarter,
        position: player?.preferred_position || 'Meio-campo',
        pitch_x: team === 'A' ? 25 : 75,
        pitch_y: 50,
        shirt_number: player?.shirt_number || index + 1,
        confirmed_attendance: true,
      };
    });

    if (rostersToInsert.length > 0) {
      await supabase.from('match_rosters').insert(rostersToInsert);
    }

    setMatches((prev) => [newMatch as Match, ...prev]);
    setActiveMatch(newMatch as Match);
    setCurrentTab('matches');
  };

  // Handler: Update Rosters (e.g. from pitch drag, balance or subs)
  const handleUpdateRosters = async (newRosters: MatchRoster[]) => {
    setRosters(newRosters);
    // Upsert into Supabase
    for (const r of newRosters) {
      await supabase
        .from('match_rosters')
        .upsert({
          id: r.id,
          match_id: r.match_id,
          player_id: r.player_id,
          team: r.team,
          is_starter: r.is_starter,
          position: r.position,
          pitch_x: r.pitch_x,
          pitch_y: r.pitch_y,
          shirt_number: r.shirt_number,
          confirmed_attendance: r.confirmed_attendance,
          updated_at: new Date().toISOString(),
        });
    }
  };

  // Handler: Add Match Event
  const handleAddEvent = async (event: Omit<MatchEvent, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('match_events')
      .insert(event)
      .select()
      .single();

    if (!error && data) {
      setEvents((prev) => [...prev, data as MatchEvent]);
    }
  };

  // Handler: Delete Match Event (Admin only)
  const handleDeleteEvent = async (eventId: string) => {
    if (!isAdmin) {
      alert('Apenas o administrador pode excluir gols ou eventos.');
      return;
    }
    const { error } = await supabase.from('match_events').delete().eq('id', eventId);
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  };

  // Handler: Delete Player (Admin only)
  const handleDeletePlayer = async (playerId: string) => {
    if (!isAdmin) {
      alert('Apenas o administrador pode excluir jogadores.');
      return;
    }
    const { error } = await supabase.from('players').delete().eq('id', playerId);
    if (error) {
      alert('Erro ao excluir jogador: ' + error.message);
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setRosters((prev) => prev.filter((r) => r.player_id !== playerId));
  };

  // Handler: Delete Match (Admin only)
  const handleDeleteMatch = async (matchId: string, matchTitle?: string) => {
    if (!isAdmin) {
      alert('Apenas o administrador pode excluir partidas.');
      return;
    }
    if (!confirm(`Deseja realmente excluir a partida "${matchTitle || 'selecionada'}" e todos os seus gols/votos?`)) {
      return;
    }
    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    if (error) {
      alert('Erro ao excluir partida: ' + error.message);
      return;
    }
    const remaining = matches.filter((m) => m.id !== matchId);
    setMatches(remaining);
    if (activeMatch?.id === matchId) {
      setActiveMatch(remaining[0] || null);
      if (!remaining[0]) {
        setRosters([]);
        setEvents([]);
      }
    }
  };

  // Handler: Clear Finished Matches History (Admin only)
  const handleClearHistory = async () => {
    if (!isAdmin || !currentGroup?.id) {
      alert('Apenas o administrador pode limpar o histórico.');
      return;
    }
    const finishedCount = matches.filter((m) => m.status === 'finished').length;
    if (finishedCount === 0) {
      alert('Não há partidas encerradas no histórico para excluir.');
      return;
    }
    if (
      !confirm(
        `Deseja realmente excluir todas as ${finishedCount} partidas encerradas do histórico? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('group_id', currentGroup.id)
      .eq('status', 'finished');

    if (error) {
      alert('Erro ao limpar histórico: ' + error.message);
      return;
    }
    const remaining = matches.filter((m) => m.status !== 'finished');
    setMatches(remaining);
    if (activeMatch?.status === 'finished') {
      setActiveMatch(remaining[0] || null);
      if (!remaining[0]) {
        setRosters([]);
        setEvents([]);
      }
    }
  };

  // Handler: Update Score
  const handleUpdateScore = async (scoreA: number, scoreB: number) => {
    if (!activeMatch) return;
    const nextStatus = activeMatch.status === 'finished' ? 'finished' : 'in_progress';
    const { data } = await supabase
      .from('matches')
      .update({ score_a: scoreA, score_b: scoreB, status: nextStatus })
      .eq('id', activeMatch.id)
      .select()
      .single();

    if (data) {
      setActiveMatch(data as Match);
      setMatches((prev) => prev.map((m) => (m.id === data.id ? (data as Match) : m)));
    }
  };

  // Handler: Finish Match
  const handleFinishMatch = async (mvpPlayerId?: string) => {
    if (!activeMatch) return;
    const { data } = await supabase
      .from('matches')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
        mvp_player_id: mvpPlayerId || null,
      })
      .eq('id', activeMatch.id)
      .select()
      .single();

    // Ensure the official Post-Match MVP Poll exists for this match
    await supabase.rpc('ensure_match_mvp_poll', { p_match_id: activeMatch.id });

    if (data) {
      setActiveMatch(data as Match);
      setMatches((prev) => prev.map((m) => (m.id === data.id ? (data as Match) : m)));
      setShowRatingModal(true);
    }
  };

  // Handler: Submit Post-Match Rating
  const handleSubmitRating = async (ratingData: Omit<PlayerRating, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('player_ratings')
      .upsert(ratingData, { onConflict: 'match_id,evaluated_player_id,evaluator_id' })
      .select()
      .single();

    if (!error && data) {
      setRatings((prev) => [...prev.filter((r) => r.id !== data.id), data as PlayerRating]);
    }
  };


  // Handler: Save Group Settings
  const handleSaveGroup = async (updated: Partial<Group>) => {
    if (!currentGroup?.id) return;
    const { data, error } = await supabase
      .from('groups')
      .update(updated)
      .eq('id', currentGroup.id)
      .select()
      .single();

    if (!error && data) {
      setCurrentGroup(data as Group);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 selection:bg-emerald-500 selection:text-slate-950">
      <Navbar
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
      />


      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 space-y-6">
        {/* TABS: MATCHES */}
        {currentTab === 'matches' && (
          <div className="space-y-5 animate-fade-in">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>Partidas de Futebol</span>
                </h1>
                <p className="text-xs text-slate-400">
                  Organize equipes, visualize a prancheta tática e acompanhe o placar ao vivo
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMatchModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Partida</span>
                </button>
              </div>
            </div>

            {/* If no matches yet */}
            {matches.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-3xl">
                  ⚽
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Nenhuma partida registrada</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Crie sua primeira partida com 5v5, 7v7, 11v11 ou monte as equipes no campo virtual.
                  </p>
                </div>

                {players.length === 0 ? (
                  <button
                    onClick={handleSeedRoster}
                    className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Carregar Elenco de Exemplo (14 Jogadores)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMatchModal(true)}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Criar Primeira Partida</span>
                  </button>
                )}
              </div>
            ) : (
              activeMatch && (
                <div className="space-y-4">
                  {/* Active Match Banner & Selector */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-lg border ${
                              activeMatch.status === 'in_progress'
                                ? 'bg-amber-950 text-amber-400 border-amber-800/60 animate-pulse'
                                : activeMatch.status === 'finished'
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                            }`}
                          >
                            {activeMatch.status === 'in_progress'
                              ? 'AO VIVO'
                              : activeMatch.status === 'finished'
                              ? 'ENCERRADA'
                              : 'PRONTA'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(activeMatch.match_date).toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <h2 className="text-xl font-black text-white mt-1">{activeMatch.title}</h2>
                        <p className="text-xs text-slate-400">{activeMatch.location || 'Local a definir'}</p>
                      </div>

                      {/* Sub-view toggle (Campo vs Central da Partida) */}
                      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
                        <button
                          onClick={() => setMatchViewMode('pitch')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            matchViewMode === 'pitch'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Campo & Escalação
                        </button>
                        <button
                          onClick={() => setMatchViewMode('live')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                            matchViewMode === 'live'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>Central do Jogo</span>
                        </button>
                        {currentGroup?.settings?.enable_finances && (
                          <button
                            onClick={() => setShowFinancesModal(true)}
                            className="px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-emerald-400 transition"
                            title="Controle financeiro da partida"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {activeMatch.status === 'finished' && (
                          <button
                            onClick={() => setShowRatingModal(true)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition flex items-center gap-1"
                            title="Votar no Craque do Jogo e dar notas"
                          >
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                            <span>Votar Craque</span>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteMatch(activeMatch.id, activeMatch.title)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-950/50 border border-rose-800/50 text-rose-400 hover:bg-rose-900/60 hover:text-rose-200 transition flex items-center gap-1"
                            title="Excluir esta partida (Apenas Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Official Post-Match MVP Voting Poll Banner (always displayed when match is finished) */}
                  {activeMatch.status === 'finished' && (
                    <MatchMvpPollBanner
                      match={activeMatch}
                      allPlayers={players}
                      onMvpUpdated={(mvpId) => {
                        if (!mvpId) return;
                        setActiveMatch((prev) => (prev ? { ...prev, mvp_player_id: mvpId } : prev));
                        setMatches((prev) =>
                          prev.map((m) =>
                            m.id === activeMatch.id ? { ...m, mvp_player_id: mvpId } : m
                          )
                        );
                      }}
                    />
                  )}

                  {/* Render Virtual Pitch OR Live Match Center */}
                  {matchViewMode === 'pitch' ? (
                    <VirtualPitch
                      match={activeMatch}
                      rosters={rosters}
                      events={events}
                      allPlayers={players}
                      onUpdateRosters={handleUpdateRosters}
                      onAddEvent={handleAddEvent}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateMatchScore={handleUpdateScore}
                      onFinishMatch={handleFinishMatch}
                    />
                  ) : (

                    <MatchLiveCenter
                      match={activeMatch}
                      rosters={rosters}
                      events={events}
                      allPlayers={players}
                      onAddEvent={handleAddEvent}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateMatchScore={handleUpdateScore}
                      onFinishMatch={handleFinishMatch}
                    />
                  )}
                </div>
              )
            )}

            {/* Matches History Section */}
            {matches.length > 0 && (
              <div className="pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-slate-300">
                    Histórico de Partidas ({matches.length})
                  </h3>
                  {isAdmin && matches.some((m) => m.status === 'finished') && (
                    <button
                      onClick={handleClearHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 text-xs font-bold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpar Histórico de Encerradas</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {matches.map((m) => {
                    const isCurrent = m.id === activeMatch?.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => setActiveMatch(m)}
                        className={`bg-slate-900 border p-4 rounded-2xl cursor-pointer transition flex items-center justify-between ${
                          isCurrent
                            ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">
                              {m.modality}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(m.match_date).toLocaleDateString('pt-BR')}
                            </span>
                            {m.status === 'finished' ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                Encerrada
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400">
                                Ativa
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-white mt-0.5">{m.title}</h4>
                          <p className="text-xs text-slate-400">
                            {m.team_a_name} {m.score_a} × {m.score_b} {m.team_b_name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMatch(m.id, m.title);
                              }}
                              className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 text-rose-400 border border-rose-800/40 transition"
                              title="Excluir partida do histórico (Admin)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TABS: PLAYERS */}
        {currentTab === 'players' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-white">Elenco de Jogadores</h1>
                <p className="text-xs text-slate-400">
                  {players.length} atletas cadastrados no grupo
                </p>
              </div>

              <div className="flex items-center gap-2">
                {players.length === 0 && (
                  <button
                    onClick={handleSeedRoster}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold border border-slate-700 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Carregar Elenco Base</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingPlayer(null);
                    setShowPlayerModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Jogador</span>
                </button>
              </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {players.map((p) => {
                const stat = playerStats.find((s) => s.player_id === p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setEditingPlayer(p);
                      setShowPlayerModal(true);
                    }}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-3xl cursor-pointer transition flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-white overflow-hidden ring-1 ring-slate-700 group-hover:ring-emerald-500 transition">
                        {p.photo_url ? (
                          p.photo_url.toLowerCase().endsWith('.pdf') || p.photo_url.startsWith('data:application/pdf') ? (
                            <span className="text-[10px] font-black text-emerald-400 uppercase">PDF</span>
                          ) : (
                            <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <span className="text-emerald-400 text-base">
                            {p.nickname?.[0] || p.name[0]}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-white">{p.nickname || p.name}</span>
                          {p.shirt_number && (
                            <span className="text-[10px] font-bold text-emerald-400">
                              #{p.shirt_number}
                            </span>
                          )}
                          {p.user_id && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
                              Login Ativo
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 block">{p.preferred_position}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                          <span>{stat?.matches_played || 0} jogos</span>
                          <span>•</span>
                          <span>{stat?.goals || 0} gols</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <div className="px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400 font-extrabold text-xs">
                          {stat?.overall_index || Math.round((p.base_rating || 6.5) * 10)}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-0.5">Overall</span>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              confirm(
                                `Deseja realmente excluir o jogador "${p.nickname || p.name}"?`
                              )
                            ) {
                              handleDeletePlayer(p.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 text-rose-400 border border-rose-800/40 transition"
                          title="Excluir jogador (Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABS: POLLS */}
        {currentTab === 'polls' && currentGroup?.id && (
          <PollsView groupId={currentGroup.id} allPlayers={players} />
        )}

        {/* TABS: RANKINGS */}
        {currentTab === 'rankings' && <RankingsView stats={playerStats} />}


        {/* TABS: SETTINGS / GROUP */}
        {currentTab === 'settings' && (
          <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                  ⚽
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">{currentGroup?.name}</h2>
                  <p className="text-xs text-slate-400">{currentGroup?.description || 'Grupo oficial'}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Modalidade padrão:</span>
                  <span className="font-bold capitalize">{currentGroup?.default_modality}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Atletas por time padrão:</span>
                  <span className="font-bold">{currentGroup?.default_players_per_team} jogadores</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400">Módulo financeiro:</span>
                  <span className="font-bold text-emerald-400">
                    {currentGroup?.settings?.enable_finances ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition"
              >
                Editar Regras e Pesos do Ranking
              </button>

              {isAdmin && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-400 block">
                    🔒 Área Exclusiva do Administrador
                  </span>
                  <button
                    onClick={handleClearHistory}
                    className="w-full py-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-rose-800/60 flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Limpar Histórico de Partidas Encerradas</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav currentTab={currentTab} onSelectTab={(t) => setCurrentTab(t)} />

      {/* MODALS */}
      {showPlayerModal && (
        <PlayerModal
          player={editingPlayer}
          groupId={currentGroup?.id || ''}
          onSave={handleSavePlayer}
          onDeletePlayer={handleDeletePlayer}
          onPlayerAccountCreated={fetchData}
          onClose={() => {
            setShowPlayerModal(false);
            setEditingPlayer(null);
          }}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          player={myPlayer}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={fetchData}
        />
      )}


      {showMatchModal && (
        <MatchCreatorModal
          groupId={currentGroup?.id || ''}
          allPlayers={players}
          onSaveMatch={handleSaveMatch}
          onClose={() => setShowMatchModal(false)}
        />
      )}

      {showRatingModal && activeMatch && (
        <MatchRatingModal
          match={activeMatch}
          rosters={rosters}
          allPlayers={players}
          existingRatings={ratings}
          onSubmitRating={handleSubmitRating}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      {showFinancesModal && activeMatch && (
        <FinancesModal
          match={activeMatch}
          rosters={rosters}
          allPlayers={players}
          onClose={() => setShowFinancesModal(false)}
        />
      )}

      {showSettingsModal && currentGroup && (
        <GroupSettingsModal
          group={currentGroup}
          onSaveGroup={handleSaveGroup}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};
export default App;
