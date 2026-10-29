import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Player, PlayerPosition, DominantFoot } from '../types/database';
import { supabase } from '../lib/supabase';
import { uploadPlayerFile } from '../lib/fileUpload';
import {
  X,
  User,
  Camera,
  Check,
  Sparkles,
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface ProfileModalProps {
  onClose: () => void;
  player?: Player | null;
  onProfileUpdated?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, player, onProfileUpdated }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || player?.photo_url || '');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [position, setPosition] = useState<PlayerPosition>(
    profile?.preferred_position || player?.preferred_position || 'Meio-campo'
  );
  const [dominantFoot, setDominantFoot] = useState<DominantFoot>(
    profile?.dominant_foot || player?.dominant_foot || 'Destro'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setNickname(profile.nickname || '');
      setAvatarUrl(profile.avatar_url || player?.photo_url || '');
      if (profile.preferred_position) setPosition(profile.preferred_position);
      if (profile.dominant_foot) setDominantFoot(profile.dominant_foot);
    }
  }, [profile, player]);

  const isPdfUrl = (url: string) =>
    url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setErrorMsg(null);

    try {
      const resultUrl = await uploadPlayerFile(file);
      setAvatarUrl(resultUrl);
      setUploadedFileName(file.name);
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'Erro ao enviar arquivo.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isUploadingFile) return;
    setIsSubmitting(true);
    setSuccessMsg(false);
    setErrorMsg(null);

    try {
      const { error } = await supabase.rpc('update_player_profile', {
        p_user_id: user.id,
        p_full_name: fullName.trim(),
        p_nickname: nickname.trim() || null,
        p_avatar_url: avatarUrl || null,
        p_position: position,
        p_dominant_foot: dominantFoot,
      });

      if (error) {
        await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            nickname: nickname.trim() || null,
            avatar_url: avatarUrl || null,
            preferred_position: position,
            dominant_foot: dominantFoot,
          })
          .eq('id', user.id);

        if (player) {
          await supabase
            .from('players')
            .update({
              name: fullName.trim(),
              nickname: nickname.trim() || null,
              photo_url: avatarUrl || null,
              preferred_position: position,
              dominant_foot: dominantFoot,
            })
            .eq('id', player.id);
        }
      }

      await refreshProfile();
      if (onProfileUpdated) onProfileUpdated();
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMsg(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="relative inline-block mx-auto mb-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full ring-4 ring-emerald-500/30 overflow-hidden bg-slate-800 flex items-center justify-center shadow-xl cursor-pointer group"
            >
              {isUploadingFile ? (
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              ) : avatarUrl ? (
                isPdfUrl(avatarUrl) ? (
                  <div className="flex flex-col items-center justify-center text-emerald-400">
                    <FileText className="w-8 h-8" />
                    <span className="text-[10px] font-bold mt-0.5">PDF</span>
                  </div>
                ) : (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                )
              ) : (
                <User className="w-10 h-10 text-slate-500" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg transition"
              title="Subir foto"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl font-black text-white flex items-center justify-center gap-1.5">
            Meu Perfil de Jogador
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>

          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              type="button"
              disabled={isUploadingFile}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{avatarUrl ? 'Trocar Foto (JPEG, PNG ou PDF)' : 'Subir Foto (JPEG, PNG ou PDF)'}</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  setAvatarUrl('');
                  setUploadedFileName('');
                }}
                className="p-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 text-rose-400 border border-rose-900/40 transition"
                title="Remover foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {uploadedFileName && (
            <p className="text-[10px] text-emerald-400 mt-1">Arquivo selecionado: {uploadedFileName}</p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            Perfil e foto atualizados com sucesso!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Apelido no Futebol
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Romário"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pé Dominante
              </label>
              <select
                value={dominantFoot}
                onChange={(e) => setDominantFoot(e.target.value as DominantFoot)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Destro">Destro</option>
                <option value="Canhoto">Canhoto</option>
                <option value="Ambidestro">Ambidestro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Posição Preferida
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as PlayerPosition)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Goleiro">🧤 Goleiro</option>
              <option value="Zagueiro">🛡️ Zagueiro</option>
              <option value="Lateral">⚡ Lateral</option>
              <option value="Meio-campo">🎯 Meio-campo</option>
              <option value="Atacante">⚽ Atacante</option>
            </select>
          </div>

          {player && (
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                Jogador Vinculado à Pelada
              </span>
              <div className="flex items-center justify-between text-xs text-white">
                <span className="font-bold">
                  {player.name} {player.shirt_number ? `(#${player.shirt_number})` : ''}
                </span>
                <span className="text-amber-400 font-bold">{player.base_rating} ⭐ Nota Base</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isUploadingFile || !fullName.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando Alterações...' : 'Salvar Meu Perfil'}
          </button>
        </form>
      </div>
    </div>
  );
};
