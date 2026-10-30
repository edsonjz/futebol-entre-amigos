import React, { useState, useRef } from 'react';
import { Player, PlayerPosition, DominantFoot } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { uploadPlayerFile } from '../lib/fileUpload';
import {
  X,
  User,
  Upload,
  FileText,
  Trash2,
  Key,
  Check,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Camera
} from 'lucide-react';

interface PlayerModalProps {
  player?: Player | null;
  groupId: string;
  onSave: (playerData: Partial<Player>) => Promise<Player | null>;
  onDeletePlayer?: (playerId: string) => Promise<void>;
  onClose: () => void;
  onPlayerAccountCreated?: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  player,
  groupId,
  onSave,
  onDeletePlayer,
  onClose,
  onPlayerAccountCreated,
}) => {
  const { isAdmin } = useAuth();
  const [name, setName] = useState(player?.name || '');
  const [nickname, setNickname] = useState(player?.nickname || '');
  const [photoUrl, setPhotoUrl] = useState(player?.photo_url || '');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [position, setPosition] = useState<PlayerPosition>(player?.preferred_position || 'Meio-campo');
  const [dominantFoot, setDominantFoot] = useState<DominantFoot>(player?.dominant_foot || 'Destro');
  const [baseRating, setBaseRating] = useState<number>(player?.base_rating ?? 6.5);
  const [shirtNumber, setShirtNumber] = useState<number | string>(player?.shirt_number ?? '');
  const [notes, setNotes] = useState(player?.notes || '');
  const [isActive, setIsActive] = useState(player?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Player account creation state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('123456');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [hasLinkedAccount, setHasLinkedAccount] = useState(!!player?.user_id);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdfUrl = (url: string) =>
    url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setFormError(null);

    try {
      const resultUrl = await uploadPlayerFile(file);
      setPhotoUrl(resultUrl);
      setUploadedFileName(file.name);
    } catch (err: any) {
      console.error('Upload error:', err);
      setFormError(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateAccountForPlayer = async (targetPlayerId?: string) => {
    const pid = targetPlayerId || player?.id;
    if (!pid) {
      setAccountError('Salve o jogador primeiro para vincular o acesso.');
      return false;
    }
    if (!accountEmail.trim() || !accountPassword.trim()) {
      setAccountError('Informe o e-mail e a senha do jogador.');
      return false;
    }

    setAccountLoading(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const { error } = await supabase.rpc('create_player_user', {
        p_player_id: pid,
        p_email: accountEmail.trim(),
        p_password: accountPassword.trim(),
        p_full_name: name.trim(),
        p_nickname: nickname.trim() || null,
      });

      if (error) throw error;

      setHasLinkedAccount(true);
      setAccountSuccess(`Login criado! E-mail: ${accountEmail.trim()} | Senha: ${accountPassword.trim()}`);
      if (onPlayerAccountCreated) onPlayerAccountCreated();
      return true;
    } catch (err: any) {
      console.error('Error creating user for player:', err);
      setAccountError(err.message || 'Erro ao criar conta para este jogador.');
      return false;
    } finally {
      setAccountLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting || isUploadingFile) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const savedPlayer = await onSave({
        group_id: groupId,
        name: name.trim(),
        nickname: nickname.trim() || null,
        photo_url: photoUrl || null,
        preferred_position: position,
        dominant_foot: dominantFoot,
        base_rating: baseRating,
        shirt_number: shirtNumber !== '' ? Number(shirtNumber) : null,
        notes: notes.trim() || null,
        is_active: isActive,
      });

      if (!savedPlayer) {
        throw new Error('Não foi possível salvar o jogador no banco de dados.');
      }

      // If admin filled in email & password to create login during player creation/edit
      if (showCreateAccount && accountEmail.trim() && accountPassword.trim()) {
        const ok = await handleCreateAccountForPlayer(savedPlayer.id);
        if (!ok) {
          setIsSubmitting(false);
          return;
        }
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving player:', err);
      setFormError(err.message || 'Erro ao salvar jogador. Verifique sua conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
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
            Cadastre o jogador, envie a foto e configure o acesso individual
          </p>
        </div>

        {formError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload Section (JPEG, PNG, PDF) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Foto do Jogador (JPEG, PNG ou PDF)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              {/* Preview Avatar / PDF Icon */}
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {isUploadingFile ? (
                  <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                ) : photoUrl ? (
                  isPdfUrl(photoUrl) ? (
                    <div className="flex flex-col items-center justify-center text-emerald-400 p-1 text-center">
                      <FileText className="w-7 h-7" />
                      <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={photoUrl}
                      alt={name || 'Foto'}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <Camera className="w-6 h-6 text-slate-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{photoUrl ? 'Trocar Arquivo' : 'Subir Foto / Arquivo'}</span>
                  </button>

                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        setUploadedFileName('');
                      }}
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 text-rose-400 border border-rose-900/40 transition"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 mt-1.5 truncate">
                  {uploadedFileName
                    ? `Arquivo: ${uploadedFileName}`
                    : photoUrl
                    ? 'Arquivo carregado com sucesso'
                    : 'Aceita JPEG, PNG ou PDF direto do celular/PC'}
                </p>
              </div>
            </div>
          </div>

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

          {/* User Account / Access for this player (works both on create and edit!) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Key className="w-4 h-4 text-emerald-400" />
                <span>Acesso / Login do Jogador</span>
              </div>
              {hasLinkedAccount ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-900/60 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Conta Vinculada
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateAccount(!showCreateAccount)}
                    className="text-[10px] font-bold text-slate-400 hover:text-white underline"
                  >
                    {showCreateAccount ? 'Fechar' : 'Alterar Senha'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateAccount(!showCreateAccount)}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
                >
                  {showCreateAccount ? 'Cancelar' : '+ Criar Login para Jogador'}
                </button>
              )}
            </div>

            {hasLinkedAccount && !showCreateAccount && (
              <p className="text-[11px] text-slate-400">
                Este jogador já possui login ativo para acessar o perfil, mudar a foto e votar nas enquetes.
              </p>
            )}

            {showCreateAccount && (
              <div className="pt-2 border-t border-slate-800 space-y-2 animate-fade-in">
                <p className="text-[11px] text-slate-400">
                  Defina o e-mail e senha para que este jogador entre no sistema, altere sua foto e vote nas enquetes:
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
                      placeholder="E-mail do jogador (ex: jogador@email.com)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Senha de acesso (ex: 123456)"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white"
                    />
                  </div>

                  {player?.id && (
                    <button
                      type="button"
                      disabled={accountLoading || !accountEmail.trim() || !accountPassword.trim()}
                      onClick={() => handleCreateAccountForPlayer(player.id)}
                      className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition disabled:opacity-50"
                    >
                      {accountLoading ? 'Gerando Acesso...' : 'Gerar / Atualizar Acesso Agora'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isUploadingFile || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Salvando...'
              : player
              ? 'Atualizar Jogador'
              : 'Adicionar à Pelada'}
          </button>

          {player?.id && isAdmin && onDeletePlayer && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                if (confirm(`Deseja realmente excluir o jogador "${player.nickname || player.name}"?`)) {
                  setIsSubmitting(true);
                  try {
                    await onDeletePlayer(player.id);
                    onClose();
                  } finally {
                    setIsSubmitting(false);
                  }
                }
              }}
              className="w-full py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir Jogador Permanentemente</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
