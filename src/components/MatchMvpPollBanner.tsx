import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Match, Player, Poll, PollVote } from '../types/database';
import { Trophy, Crown, Check, Users, Lock, Unlock, Sparkles, Vote } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MatchMvpPollBannerProps {
  match: Match;
  allPlayers: Player[];
  onMvpUpdated?: (mvpPlayerId: string | null) => void;
  compact?: boolean;
}

export const MatchMvpPollBanner: React.FC<MatchMvpPollBannerProps> = ({
  match,
  allPlayers,
  onMvpUpdated,
  compact = false,
}) => {
  const { user, userRole } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  const loadOrEnsureMvpPoll = async () => {
    if (!match?.id) return;
    setIsLoading(true);
    try {
      // Ensure the MVP poll exists in database for this match
      await supabase.rpc('ensure_match_mvp_poll', { p_match_id: match.id });

      const { data: pollData } = await supabase
        .from('polls')
        .select('*')
        .eq('match_id', match.id)
        .eq('poll_type', 'mvp')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pollData) {
        const loadedPoll = pollData as Poll;
        setPoll(loadedPoll);

        const { data: votesData } = await supabase
          .from('poll_votes')
          .select('*')
          .eq('poll_id', loadedPoll.id);

        if (votesData) {
          setVotes(votesData as PollVote[]);
        }
      }
    } catch (err) {
      console.error('Error loading MVP poll:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (match.status === 'finished') {
      loadOrEnsureMvpPoll();
    }
  }, [match.id, match.status]);

  // Realtime subscription for votes on this poll
  useEffect(() => {
    if (!poll?.id) return;

    const channel = supabase
      .channel(`mvp-poll-${poll.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        async () => {
          const { data } = await supabase
            .from('poll_votes')
            .select('*')
            .eq('poll_id', poll.id);
          if (data) setVotes(data as PollVote[]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `id=eq.${poll.id}` },
        (payload) => {
          if (payload.new) setPoll(payload.new as Poll);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll?.id]);

  if (match.status !== 'finished') return null;

  if (isLoading) {
    return (
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-4 text-center text-xs text-amber-300 animate-pulse">
        🏆 Carregando enquete oficial de Craque do Jogo...
      </div>
    );
  }

  if (!poll) return null;

  const totalVotes = votes.length;
  const currentUserId = user?.id;
  const myVote = currentUserId ? votes.find((v) => v.user_id === currentUserId) : null;

  // Calculate vote counts per option
  const optionsWithVotes = (poll.options || []).map((opt) => {
    const count = votes.filter((v) => v.option_id === opt.id).length;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const player = allPlayers.find((p) => p.id === opt.id);
    return {
      ...opt,
      count,
      percentage,
      player,
    };
  });

  const maxVotes = Math.max(0, ...optionsWithVotes.map((o) => o.count));
  const leaderOption =
    maxVotes > 0 ? optionsWithVotes.find((o) => o.count === maxVotes) || null : null;

  const handleVoteMvp = async (optionId: string) => {
    if (!user) {
      alert('Faça login com seu e-mail e senha para votar no Craque do Jogo!');
      return;
    }
    if (poll.is_closed || isVoting) return;
    setIsVoting(true);

    try {
      const existingVote = votes.find((v) => v.user_id === user.id);
      if (existingVote) {
        if (existingVote.option_id === optionId) {
          setIsVoting(false);
          return;
        }
        const { error } = await supabase
          .from('poll_votes')
          .update({ option_id: optionId })
          .eq('id', existingVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('poll_votes').insert({
          poll_id: poll.id,
          user_id: user.id,
          option_id: optionId,
        });
        if (error) throw error;
      }

      // Optimistic state update
      const updatedVotes: PollVote[] = [
        ...votes.filter((v) => v.user_id !== user.id),
        {
          id: existingVote?.id || 'temp-' + Date.now(),
          poll_id: poll.id,
          user_id: user.id,
          option_id: optionId,
          created_at: new Date().toISOString(),
        },
      ];
      setVotes(updatedVotes);

      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.7 },
      });

      if (onMvpUpdated) {
        onMvpUpdated(optionId);
      }
    } catch (err: any) {
      console.error('Error voting MVP:', err);
      alert('Não foi possível registrar seu voto: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsVoting(false);
    }
  };

  const handleToggleLock = async () => {
    if (!poll) return;
    const nextClosed = !poll.is_closed;
    await supabase.from('polls').update({ is_closed: nextClosed }).eq('id', poll.id);
    setPoll({ ...poll, is_closed: nextClosed });
  };

  const isPdfUrl = (url?: string | null) =>
    Boolean(url && (url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf')));

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-950/50">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                🏆 Enquete Oficial Pós-Jogo
              </span>
              {poll.is_closed ? (
                <span className="text-[10px] font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-800/50 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Votação Encerrada
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-800/50 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Votação Aberta
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
              Eleja o Craque do Jogo (MVP)
            </h3>
            <p className="text-xs text-slate-400">
              Toque em quem jogou mais bola na partida para registrar seu voto!
            </p>
          </div>
        </div>

        {/* Current MVP Winner / Leader Pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {leaderOption && (
            <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 px-3.5 py-2 rounded-2xl">
              <Crown className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                  {poll.is_closed ? 'Craque Eleito (MVP)' : 'Líder da Votação'}
                </span>
                <span className="text-xs sm:text-sm font-black text-white">
                  {leaderOption.player?.nickname || leaderOption.player?.name || leaderOption.text} (
                  {leaderOption.count} {leaderOption.count === 1 ? 'voto' : 'votos'})
                </span>
              </div>
            </div>
          )}

          {userRole === 'admin' && (
            <button
              onClick={handleToggleLock}
              title={poll.is_closed ? 'Reabrir Enquete de Craque' : 'Encerrar Enquete de Craque'}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            >
              {poll.is_closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Candidates Voting Grid */}
      <div
        className={`grid grid-cols-1 ${
          compact ? 'sm:grid-cols-1 max-h-64' : 'sm:grid-cols-2 max-h-80'
        } gap-2.5 overflow-y-auto pr-1`}
      >
        {optionsWithVotes.map((opt) => {
          const isSelected = myVote?.option_id === opt.id;
          const isLeader = maxVotes > 0 && opt.count === maxVotes;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={poll.is_closed || isVoting}
              onClick={() => handleVoteMvp(opt.id)}
              className={`relative w-full text-left p-3 rounded-2xl border transition overflow-hidden group ${
                isSelected
                  ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/60 shadow-lg shadow-amber-950/40'
                  : isLeader
                  ? 'border-amber-500/40 bg-slate-800/70 hover:bg-slate-800'
                  : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/70 hover:border-slate-700'
              }`}
            >
              {/* Animated Vote Percentage Bar */}
              <div
                className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                  isSelected || isLeader ? 'bg-amber-500/20' : 'bg-slate-700/25'
                }`}
                style={{ width: `${opt.percentage}%` }}
              />

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Radio / Avatar */}
                  <div className="relative w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
                    {opt.player?.photo_url && !isPdfUrl(opt.player.photo_url) ? (
                      <img
                        src={opt.player.photo_url}
                        alt={opt.player.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-amber-400">
                        {opt.player?.nickname?.[0] || opt.player?.name?.[0] || '⭐'}
                      </span>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-500/80 flex items-center justify-center text-slate-950">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isLeader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span className="text-xs sm:text-sm font-bold text-white truncate">
                        {opt.text}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {isSelected ? '✓ Seu voto para Craque' : 'Toque para votar'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-300 font-semibold">
                    {opt.count} {opt.count === 1 ? 'voto' : 'votos'}
                  </span>
                  <span className="text-xs font-black text-amber-400 w-9 text-right">
                    {opt.percentage}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Total de votos: <strong className="text-white">{totalVotes}</strong>
          </span>
        </div>
        <div>
          {myVote ? (
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Vote className="w-3.5 h-3.5" /> Seu voto está computado! (Toque em outro para alterar)
            </span>
          ) : (
            <span className="text-slate-400">
              O mais votado recebe automaticamente o troféu de MVP da partida
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
