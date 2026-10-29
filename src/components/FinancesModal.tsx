import React, { useState, useEffect } from 'react';
import { Match, MatchRoster, Player } from '../types/database';
import { supabase } from '../lib/supabase';
import { X, DollarSign, CheckCircle2, Clock, Save, Check } from 'lucide-react';

interface FinancesModalProps {
  match: Match;
  rosters: MatchRoster[];
  allPlayers: Player[];
  onClose: () => void;
}

export const FinancesModal: React.FC<FinancesModalProps> = ({
  match,
  rosters,
  allPlayers,
  onClose,
}) => {
  const [fieldCost, setFieldCost] = useState<number>(250);
  const [paidPlayers, setPaidPlayers] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const participating = rosters
    .map((r) => r.player || allPlayers.find((p) => p.id === r.player_id))
    .filter((p): p is Player => Boolean(p));

  const costPerPlayer = participating.length > 0 ? (fieldCost / participating.length).toFixed(2) : '0.00';
  const totalCollected = (paidPlayers.size * parseFloat(costPerPlayer)).toFixed(2);

  useEffect(() => {
    const loadFinances = async () => {
      const { data: fin } = await supabase
        .from('match_finances')
        .select('*')
        .eq('match_id', match.id)
        .maybeSingle();

      if (fin && fin.field_cost !== undefined) {
        setFieldCost(Number(fin.field_cost));
      }

      const { data: payments } = await supabase
        .from('player_payments')
        .select('*')
        .eq('match_id', match.id)
        .eq('is_paid', true);

      if (payments) {
        setPaidPlayers(new Set(payments.map((p: any) => p.player_id)));
      }
    };
    loadFinances();
  }, [match.id]);

  const togglePaid = async (playerId: string) => {
    const isCurrentlyPaid = paidPlayers.has(playerId);
    const nextState = !isCurrentlyPaid;

    setPaidPlayers((prev) => {
      const next = new Set(prev);
      if (nextState) next.add(playerId);
      else next.delete(playerId);
      return next;
    });

    await supabase.from('player_payments').upsert(
      {
        match_id: match.id,
        player_id: playerId,
        amount: parseFloat(costPerPlayer) || 0,
        is_paid: nextState,
        paid_at: nextState ? new Date().toISOString() : null,
      },
      { onConflict: 'match_id,player_id' }
    );
  };

  const handleSaveFinances = async () => {
    setIsSaving(true);
    try {
      await supabase.from('match_finances').upsert(
        {
          match_id: match.id,
          field_cost: fieldCost,
          player_fee: parseFloat(costPerPlayer) || 0,
          total_collected: parseFloat(totalCollected) || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' }
      );
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setIsSaving(false);
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
            <DollarSign className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-white">Controle Financeiro da Partida</h2>
          <p className="text-xs text-slate-400">{match.title}</p>
        </div>

        {savedToast && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Valores salvos no banco de dados!</span>
          </div>
        )}

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-2xl">
            <span className="text-[10px] text-slate-400 block font-semibold">Custo Quadra</span>
            <span className="text-sm font-black text-white">R$ {fieldCost}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-2xl">
            <span className="text-[10px] text-slate-400 block font-semibold">Por Jogador</span>
            <span className="text-sm font-black text-emerald-400">R$ {costPerPlayer}</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-2xl">
            <span className="text-[10px] text-slate-400 block font-semibold">Arrecadado</span>
            <span className="text-sm font-black text-sky-400">R$ {totalCollected}</span>
          </div>
        </div>

        {/* Cost input */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-300 mb-1">
            Valor Total do Aluguel da Quadra (R$)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={fieldCost}
              onChange={(e) => setFieldCost(parseFloat(e.target.value) || 0)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-sm text-white"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveFinances}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
            </button>
          </div>
        </div>

        {/* List of Players with Paid status toggle */}
        <div>
          <span className="text-xs font-bold text-slate-300 block mb-2">
            Status de Pagamento ({paidPlayers.size}/{participating.length} pagos)
          </span>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {participating.map((p) => {
              const isPaid = paidPlayers.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => togglePaid(p.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition select-none ${
                    isPaid
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-white'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isPaid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="font-semibold">{p.nickname || p.name}</span>
                  </div>
                  <span className={`font-bold ${isPaid ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isPaid ? 'PAGO' : 'PENDENTE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
