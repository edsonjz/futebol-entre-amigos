import React, { useState, useEffect } from 'react';
import { Player, PlayerPosition, DominantFoot } from '../types/database';
import { supabase } from '../lib/supabase';
import { X, User, Image, Shield, Sparkles, Hash, Key, Check, Lock, Mail } from 'lucide-react';

interface PlayerModalProps {
  player?: Player | null;
  groupId: string;
  onSave: (playerData: Partial<Player>) => Promise<void>;
  onClose: () => void;
  onPlayerAccountCreated?: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  groupId,
  onSave,
  onClose,
  onPlayerAccountCreated,
}) => {
  const [name, setName] = useState(player?.name || '');
  const [nickname, setNickname] = useState(player?.nickname || '');
  const [photoUrl, setPhotoUrl] = useState(player?.photo_url || '');
  const [position, setPosition] = useState<PlayerPosition>(player?.preferred_position || 'Meio-campo');
  const [dominantFoot, setDominantFoot] = useState<DominantFoot>(player?.dominant_foot || 'Destro');
  const [baseRating, setBaseRating] = useState<number>(player?.base_rating ?? 6.5);
  const [shirtNumber, setShirtNumber] = useState<number | string>(player?.shirt_number ?? '');
  const [notes, setNotes] = useState(player?.notes || '');
  const [isActive, setIsActive] = useState(player?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Player account creation state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('123456');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [hasLinkedAccount, setHasLinkedAccount] = useState(!!player?.user_id);

  const handleCreateAccountForPlayer = async () => {
    if (!player?.id) {
      setAccountError('Salve o jogador primeiro antes de criar o acesso de login.');
      return;
    }
    if (!accountEmail.trim() || !accountPassword.trim()) {
      setAccountError('Informe o e-mail e a senha do jogador.');
      return;
    }
    setAccountLoading(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const { data, error } = await supabase.rpc('create_player_user', {
        p_player_id: player.id,
        p_email: accountEmail.trim(),
        p_password: accountPassword.trim(),
        p_full_name: name.trim(),
        p_nickname: nickname.trim() || null,
      });

      if (error) throw error;

      setHasLinkedAccount(true);
      setAccountSuccess(`Acesso criado com sucesso! E-mail: ${accountEmail} / Senha: ${accountPassword}`);
      if (onPlayerAccountCreated) onPlayerAccountCreated();
    } catch (err: any) {
      console.error('Error creating user for player:', err);
      setAccountError(err.message || 'Erro ao criar conta para este jogador.');
    } finally {
      setAccountLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      await onSave({
        group_id: groupId,
        name: name.trim(),
        nickname: nickname.trim() || null,
        photo_url: photoUrl.trim() || null,
        preferred_position: position,
        dominant_foot: dominantFoot,
        base_rating: baseRating,
        shirt_number: shirtNumber ? Number(shirtNumber) : null,
        notes: notes.trim() || null,
        is_active: isActive,
      });
      onClose();
    } catch (err) {
      console.error('Error saving player:', err);
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
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-white">
            {player ? 'Editar Jogador' : 'Novo Jogador'}
          </h2>
          <p className="text-xs text-slate-400">
            Cadastre os amigos da pelada com suas posições e notas iniciais
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Apelido no Futebol
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Kadu"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Número da Camisa
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={shirtNumber}
                onChange={(e) => setShirtNumber(e.target.value)}
                placeholder="Ex: 10"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              URL da Foto / Avatar
            </label>
            <div className="relative">
              <Image className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Posição Preferida
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as PlayerPosition)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
              >
                <option value="Goleiro">🧤 Goleiro</option>
                <option value="Zagueiro">🛡️ Zagueiro</option>
                <option value="Lateral">⚡ Lateral</option>
                <option value="Meio-campo">🎯 Meio-campo</option>
                <option value="Atacante">⚽ Atacante</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Pé Dominante
              </label>
              <select
                value={dominantFoot}
                onChange={(e) => setDominantFoot(e.target.value as DominantFoot)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white"
              >
                <option value="Destro">Destro</option>
                <option value="Canhoto">Canhoto</option>
                <option value="Ambidestro">Ambidestro</option>
              </select>
            </div>
          </div>

          {/* Base Rating (Benchmark for smart balance) */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-300">Nota Base Inicial</span>
              <span className="text-sm font-black text-amber-400">{baseRating.toFixed(1)} ⭐</span>
            </div>
            <input
              type="range"
              min="4.0"
              max="9.9"
              step="0.1"
              value={baseRating}
              onChange={(e) => setBaseRating(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Utilizada pelo algoritmo de sorteio equilibrado até o jogador acumular partidas.
            </span>
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div>
              <span className="text-xs font-bold text-white block">Jogador Ativo</span>
              <span className="text-[10px] text-slate-400">
                Se inativo, não aparecerá em novos jogos, mas preservará todo o histórico.
              </span>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700 focus:ring-emerald-500"
            />
          </div>

          {/* User Account / Access for this player */}
          {player && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <span>Acesso / Login do Jogador</span>
                </div>
                {hasLinkedAccount ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/60 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Conta Vinculada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateAccount(!showCreateAccount)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    {showCreateAccount ? 'Cancelar' : '+ Criar Login'}
                  </button>
                )}
              </div>

              {hasLinkedAccount && (
                <p className="text-[11px] text-slate-400">
                  Este jogador já possui login ativo e pode votar em enquetes e alterar a própria foto.
                </p>
              )}

              {showCreateAccount && !hasLinkedAccount && (
                <div className="pt-2 border-t border-slate-800 space-y-2 animate-fade-in">
                  <p className="text-[11px] text-slate-400">
                    Crie um e-mail e senha para que este amigo acesse o app, altere a foto do perfil e participe das votações:
                  </p>

                  {accountError && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                      {accountError}
                    </div>
                  )}

                  {accountSuccess && (
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]">
                      {accountSuccess}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        placeholder="E-mail do jogador (ex: amigo@gmail.com)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder="Senha de acesso"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={accountLoading || !accountEmail.trim() || !accountPassword.trim()}
                      onClick={handleCreateAccountForPlayer}
                      className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-50"
                    >
                      {accountLoading ? 'Criando Conta...' : 'Salvar e Gerar Acesso'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : player ? 'Atualizar Jogador' : 'Adicionar à Pelada'}
          </button>
        </form>
      </div>
    </div>
  );
};
