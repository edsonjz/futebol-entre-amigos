import React, { useState, useEffect } from 'react';
import { Player, PlayerPosition, DominantFoot } from '../types/database';
import { X, User, Image, Shield, Sparkles, Hash } from 'lucide-react';

interface PlayerModalProps {
  player?: Player | null;
  groupId: string;
  onSave: (playerData: Partial<Player>) => Promise<void>;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  groupId,
  onSave,
  onClose,
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
