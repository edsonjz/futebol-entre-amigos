import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Poll, PollOption, PollVote } from '../types/database';
import { supabase } from '../lib/supabase';
import {
  Vote,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Lock,
  Unlock,
  Users,
  Sparkles,
  Check,
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';

interface PollsViewProps {
  groupId: string;
}

export const PollsView: React.FC<PollsViewProps> = ({ groupId }) => {
  const { user, userRole } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New poll form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'custom' | 'presence'>('presence');
  const [optionsList, setOptionsList] = useState<string[]>(['✅ Sim, vou jogar', '⏳ Em dúvida', '❌ Não posso ir']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPollsAndVotes = async () => {
    try {
      setIsLoading(true);
      const { data: pollsData } = await supabase
        .from('polls')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (pollsData) {
        setPolls(pollsData as Poll[]);
      }

      const { data: votesData } = await supabase.from('poll_votes').select('*');
      if (votesData) {
        setVotes(votesData as PollVote[]);
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchPollsAndVotes();
    }
  }, [groupId]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel('polls-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes' },
        () => {
          supabase.from('poll_votes').select('*').then(({ data }) => {
            if (data) setVotes(data as PollVote[]);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `group_id=eq.${groupId}` },
        () => {
          fetchPollsAndVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      alert('Faça login com seu e-mail para registrar seu voto!');
      return;
    }

    try {
      // Upsert vote
      const existingVote = votes.find((v) => v.poll_id === pollId && v.user_id === user.id);

      if (existingVote) {
        if (existingVote.option_id === optionId) return;
        const { error } = await supabase
          .from('poll_votes')
          .update({ option_id: optionId })
          .eq('id', existingVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('poll_votes').insert({
          poll_id: pollId,
          user_id: user.id,
          option_id: optionId,
        });
        if (error) throw error;
      }

      // Optimistic update
      setVotes((prev) => {
        const filtered = prev.filter((v) => !(v.poll_id === pollId && v.user_id === user.id));
        return [
          ...filtered,
          {
            id: 'temp-' + Date.now(),
            poll_id: pollId,
            user_id: user.id,
            option_id: optionId,
            created_at: new Date().toISOString(),
          },
        ];
      });
    } catch (err: any) {
      console.error('Error voting:', err);
      alert('Erro ao registrar voto: ' + (err.message || 'Tente novamente.'));
    }
  };

  const handleToggleClose = async (poll: Poll) => {
    try {
      await supabase.from('polls').update({ is_closed: !poll.is_closed }).eq('id', poll.id);
      setPolls((prev) =>
        prev.map((p) => (p.id === poll.id ? { ...p, is_closed: !p.is_closed } : p))
      );
    } catch (err) {
      console.error('Error toggling poll:', err);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Deseja realmente excluir esta enquete?')) return;
    try {
      await supabase.from('polls').delete().eq('id', pollId);
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } catch (err) {
      console.error('Error deleting poll:', err);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting || !user) return;
    setIsSubmitting(true);

    try {
      const formattedOptions: PollOption[] = optionsList
        .filter((opt) => opt.trim().length > 0)
        .map((text, idx) => ({
          id: String(idx + 1),
          text: text.trim(),
        }));

      if (formattedOptions.length < 2) {
        alert('Informe pelo menos 2 opções para a votação.');
        return;
      }

      const { data, error } = await supabase
        .from('polls')
        .insert({
          group_id: groupId,
          created_by: user.id,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          poll_type: newType,
          options: formattedOptions,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setPolls((prev) => [data as Poll, ...prev]);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
      }
    } catch (err: any) {
      console.error('Error creating poll:', err);
      alert('Erro ao criar enquete: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Vote className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white tracking-tight">
              Enquetes & Votações da Pelada
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Confirmação de presença para os jogos, votações de MVP e decisões da galera.
          </p>
        </div>

        {user && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Enquete
          </button>
        )}
      </div>

      {/* Polls List */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
          Carregando enquetes do grupo...
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-3">
            <Vote className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nenhuma enquete ativa</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Crie a primeira votação para confirmar quem vai jogar na próxima pelada!
          </p>
          {user && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition"
            >
              <Plus className="w-4 h-4" />
              Criar Enquete
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {polls.map((poll) => {
            const pollVotes = votes.filter((v) => v.poll_id === poll.id);
            const totalVotes = pollVotes.length;
            const myVote = user ? pollVotes.find((v) => v.user_id === user.id) : null;

            return (
              <div
                key={poll.id}
                className={`relative bg-slate-900/90 border rounded-3xl p-5 shadow-xl transition flex flex-col justify-between ${
                  poll.is_closed ? 'border-slate-800 opacity-80' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        poll.poll_type === 'presence'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {poll.poll_type === 'presence' ? '⚽ Presença na Pelada' : '📊 Votação Livre'}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs">
                      {poll.is_closed ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-900/50">
                          <Lock className="w-3 h-3" /> Encerrada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-900/50">
                          <Clock className="w-3 h-3 animate-pulse" /> Aberta
                        </span>
                      )}

                      {userRole === 'admin' && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleToggleClose(poll)}
                            title={poll.is_closed ? 'Reabrir votação' : 'Encerrar votação'}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          >
                            {poll.is_closed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeletePoll(poll.id)}
                            title="Excluir"
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Desc */}
                  <h3 className="text-base font-bold text-white mb-1">{poll.title}</h3>
                  {poll.description && (
                    <p className="text-xs text-slate-400 mb-4">{poll.description}</p>
                  )}

                  {/* Options List */}
                  <div className="space-y-2.5 my-4">
                    {poll.options.map((option) => {
                      const optVotes = pollVotes.filter((v) => v.option_id === option.id).length;
                      const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                      const isSelected = myVote?.option_id === option.id;

                      return (
                        <button
                          key={option.id}
                          disabled={poll.is_closed}
                          onClick={() => handleVote(poll.id, option.id)}
                          className={`relative w-full text-left p-3 rounded-2xl border transition overflow-hidden group ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/50'
                              : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          {/* Progress fill bar */}
                          <div
                            className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${
                              isSelected ? 'bg-emerald-500/20' : 'bg-slate-700/30'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex items-center justify-between z-10">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                                  isSelected
                                    ? 'border-emerald-400 bg-emerald-500 text-white'
                                    : 'border-slate-600 bg-slate-900 group-hover:border-slate-400'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className="text-xs font-semibold text-white">
                                {option.text}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-medium">
                                {optVotes} {optVotes === 1 ? 'voto' : 'votos'}
                              </span>
                              <span className="text-xs font-bold text-white w-9 text-right">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer with total votes */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>Total: <strong className="text-slate-200">{totalVotes}</strong> votos</span>
                  </div>
                  {myVote ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Você já votou
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Clique em uma opção para votar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nova Enquete */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-2">
                <Vote className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-white">Criar Nova Enquete</h2>
              <p className="text-xs text-slate-400">
                Lançar votação de presença ou decisão para a galera da pelada
              </p>
            </div>

            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tipo de Votação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewType('presence');
                      setOptionsList(['✅ Sim, vou jogar', '⏳ Em dúvida', '❌ Não posso ir']);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      newType === 'presence'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    ⚽ Presença no Jogo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewType('custom');
                      setOptionsList(['Opção 1', 'Opção 2', 'Opção 3']);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      newType === 'custom'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    📊 Votação Livre
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título da Enquete *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Quem vai no jogo de Sexta-feira?"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: Quadra 3, às 19:30h. Confirmem até quinta!"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Opções de Voto
                  </label>
                  <button
                    type="button"
                    onClick={() => setOptionsList((prev) => [...prev, `Opção ${prev.length + 1}`])}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Opção
                  </button>
                </div>

                <div className="space-y-2">
                  {optionsList.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => {
                          const updated = [...optionsList];
                          updated[i] = e.target.value;
                          setOptionsList(updated);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-1.5 px-3 text-xs text-white"
                      />
                      {optionsList.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptionsList((prev) => prev.filter((_, idx) => idx !== i))}
                          className="p-1.5 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !newTitle.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Publicando...' : 'Publicar Enquete'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
