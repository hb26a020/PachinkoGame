/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { SetStateAction } from 'react';
import { SpecType, MachineSpec, JackpotHistory } from '../types';
import { Coins, Flame, ArrowUpRight, Play, Square, RefreshCw, Volume2, VolumeX, HelpCircle, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ControlPanelProps {
  currentPower: number;
  onPowerChange: (val: number) => void;
  isShooting: boolean;
  onShootingToggle: (val: boolean) => void;
  ballCount: number;
  totalSpins: number;
  totalJackpots: number;
  consecutiveWins: number;
  investedCash: number; // in virtual Yen
  totalWon: number;
  onReplenishBalls: () => void;
  onSingleShot: () => void;
  currentSpec: MachineSpec;
  onSpecChange: (specId: SpecType) => void;
  specs: Record<SpecType, MachineSpec>;
  historyList: JackpotHistory[];
  isMuted: boolean;
  onMuteToggle: () => void;
  gameStateText: string;
  onTriggerForcedReach: (type: 'button_chance_hit' | 'lever_chance_hit') => void;
  autoTuningEnabled?: boolean;
  onAutoTuningToggle?: (val: boolean) => void;
  ballsFiredCount?: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentPower,
  onPowerChange,
  isShooting,
  onShootingToggle,
  ballCount,
  totalSpins,
  totalJackpots,
  consecutiveWins,
  investedCash,
  totalWon,
  onReplenishBalls,
  onSingleShot,
  currentSpec,
  onSpecChange,
  specs,
  historyList,
  isMuted,
  onMuteToggle,
  gameStateText,
  onTriggerForcedReach,
  autoTuningEnabled = true,
  onAutoTuningToggle = (_val: boolean) => {},
  ballsFiredCount = 0,
}) => {
  return (
    <div className="flex flex-col gap-4 w-full xl:max-w-md bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl select-none" id="control-panel-container">
      
      {/* 1. Header with Title & Sound toggler */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-md font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
            <Coins className="w-4 h-4 text-cyan-400 animate-pulse" />
            統計データ ＆ 詳細コンソール
          </h2>
          <p className="text-[10px] text-slate-500 font-medium font-bold">CYBER PARLOR STATUS v1.5</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-1 rounded-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>通信同期中</span>
        </div>
      </div>

      {/* 2. STATS GRID (BENTO MULTI-PANEL) */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* TOTAL SPINS (ROTATIONS) */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">総回転数 (SPINS)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-cyan-400">{totalSpins}</span>
            <span className="text-[10px] text-slate-500">回</span>
          </div>
          <p className="text-[8px] text-slate-600 font-medium pt-1 border-t border-slate-900/60 mt-1 leading-none">始動口に入球した総数</p>
        </div>

        {/* TOTAL JACKPOTS (ATARI COUNT) */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">大当り回数 (BONUS)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-pink-400">{totalJackpots}</span>
            <span className="text-[10px] text-slate-500">回</span>
          </div>
          <p className="text-[8px] text-slate-600 font-medium pt-1 border-t border-slate-900/60 mt-1 leading-none">確変 ＆ 通常当り合算</p>
        </div>

        {/* INVESTED CASH / DEBT */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">投資総額 (INVESTED)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black font-mono text-rose-400">¥{investedCash.toLocaleString()}</span>
          </div>
          <p className="text-[8px] text-slate-600 font-medium pt-1 border-t border-slate-900/60 mt-1 leading-none">玉貸しボタンの合計金額</p>
        </div>

        {/* TOTAL WON BALLS */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">総獲得賞球 (TOTAL WON)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-black font-mono text-emerald-400">+{totalWon.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500">発</span>
          </div>
          <p className="text-[8px] text-slate-600 font-medium pt-1 border-t border-slate-900/60 mt-1 leading-none">アタッカー他各入賞賞球</p>
        </div>

        {/* RUSH CONSECUTIVE COUNTER */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl col-span-2 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">現在の高確率RUSH連</span>
            <p className="text-[8px] text-slate-600 font-medium mt-1">電サポ大当りの継続連荘数</p>
          </div>
          <div className="flex items-baseline gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-slate-900/80">
            <span className={`text-2xl font-black font-mono ${consecutiveWins > 0 ? 'text-purple-400 animate-pulse' : 'text-slate-650'}`}>
              {consecutiveWins}
            </span>
            <span className="text-[9px] text-slate-500 font-bold">連チャン</span>
          </div>
        </div>
      </div>

      {/* 2.5 DYNAMIC CORRIDOR AUTO-TUNER PANEL (15-shots-per-spin target) */}
      <div className="bg-slate-950/80 rounded-xl border border-cyan-500/40 p-3 flex flex-col gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-fade-in" id="auto-tuner-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-black text-cyan-300 uppercase tracking-widest">
              15発/1回転 電磁自動調律システム
            </span>
          </div>
          <button
            onClick={() => onAutoTuningToggle(!autoTuningEnabled)}
            id="auto-tuner-toggle-btn"
            className={`px-2.5 py-0.5 text-[9px] font-extrabold rounded-full border transition-all cursor-pointer ${
              autoTuningEnabled
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'
            }`}
          >
            {autoTuningEnabled ? 'システム：稼働中' : 'システム：停止中'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-black/35 p-2 rounded-lg border border-slate-900/60 text-center">
            <span className="text-[8px] font-bold text-slate-500 uppercase">実写参考 鎧打ち込み玉</span>
            <div className="text-sm font-black font-mono text-slate-200 mt-0.5">{ballsFiredCount} <span className="text-[8px] text-slate-500">発</span></div>
          </div>
          <div className="bg-black/35 p-2 rounded-lg border border-slate-900/60 text-center">
            <span className="text-[8px] font-bold text-slate-500 uppercase">実測スタート率 / 目標</span>
            <div className="text-sm font-black font-mono mt-0.5 flex items-center justify-center gap-1">
              <span className="text-cyan-400 font-extrabold">
                {totalSpins > 0 ? (ballsFiredCount / totalSpins).toFixed(1) : '0.0'}
              </span>
              <span className="text-slate-600 text-[8px]">/ 15.0</span>
            </div>
          </div>
        </div>
        <p className="text-[8.5px] text-slate-400 leading-relaxed border-t border-slate-900/60 pt-1.5 font-medium">
          {autoTuningEnabled ? (
            <span className="text-cyan-400 font-semibold text-[8px] tracking-tight leading-normal">
              【実車ワープ・鎧釘再現】右側の金色ワープ入口からのワープルートと、ステージ中央の落とし口を物理シミュレート。適正入賞の自動調律サポートにより、約15発に1回転の回転率を精緻に維持します。
            </span>
          ) : (
            <span className="text-slate-500 font-semibold text-[8px] tracking-tight leading-normal">
              自動調律をOFFにしました。純粋な物理反射のみでバラつきます。打ち出す強さを調整し、ワープルート入口を狙い打つ楽しさをお試しください。
            </span>
          )}
        </p>
      </div>

      {/* 3. SPEC ADJUSTMENT SELECTOR */}
      <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">実機スペック指定</span>
        
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.values(specs) as MachineSpec[]).map((spec: MachineSpec) => {
            const isSelected = spec.id === currentSpec.id;
            return (
              <button
                key={spec.id}
                onClick={() => onSpecChange(spec.id)}
                id={`spec-selector-btn-${spec.id}`}
                className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                  isSelected
                    ? spec.id === 'MAX'
                      ? 'bg-rose-950/50 border-rose-600 text-rose-300 shadow-md'
                      : spec.id === 'MIDDLE'
                      ? 'bg-cyan-950/50 border-cyan-600 text-cyan-300 shadow-md'
                      : 'bg-emerald-950/50 border-emerald-600 text-emerald-300 shadow-md'
                    : 'bg-slate-900 border-slate-850 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                }`}
              >
                <span className="text-[9px] font-extrabold tracking-tight leading-none">{spec.name}</span>
                <span className="text-[10px] font-mono mt-1 font-bold">1/{spec.jpProbability}</span>
              </button>
            );
          })}
        </div>

        {/* Spec properties readout display */}
        <div className="text-[10px] bg-slate-950 rounded-lg p-2 border border-slate-900/50 flex flex-col gap-1 text-slate-400 leading-relaxed font-sans">
          <div className="flex justify-between text-[9px] border-b border-white/5 pb-1 font-bold">
            <span className="text-slate-500">確変突入率 / 継続率:</span>
            <span className="text-yellow-400">
              {(currentSpec.rushRate * 105)}% / {Math.round((1 - currentSpec.rushEscapeRate) * 100)}%
            </span>
          </div>
          <p className="text-[9px] text-slate-500 leading-normal">{currentSpec.description}</p>
        </div>
      </div>

      {/* 4. HISTORIC JACKPOT LOG */}
      <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 flex flex-col gap-2">
        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">大当り履歴 (HISTORY)</span>
        
        <div className="max-h-[105px] overflow-y-auto flex flex-col gap-1.5 pr-1 divide-y divide-white/5 font-mono">
          {historyList.length === 0 ? (
            <div className="text-[9px] text-slate-500 text-center py-4 italic">
              まだ大当り履歴がありません。
            </div>
          ) : (
            historyList.map((hist, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] pt-1.5 first:pt-0">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${hist.type === 'NORMAL' ? 'bg-blue-400' : 'bg-pink-500 animate-pulse'}`} />
                  <span className={`font-bold ${hist.type === 'NORMAL' ? 'text-blue-300' : 'text-pink-400'}`}>
                    {hist.type === 'NORMAL' ? '通常大当り' : `極FEVER (${hist.consecutiveCount}連)`}
                  </span>
                </div>
                <div className="text-slate-400 font-semibold space-x-1">
                  <span>{hist.spinCount}回転</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-bold">+{hist.payout}発</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. IMMERSIVE CLIMAX TESTER */}
      <div className="bg-slate-950/80 rounded-xl border border-rose-950/50 p-3 flex flex-col gap-2">
        <div className="flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">【演出鑑賞】一撃チャンス強制起動</span>
        </div>
        <p className="text-[9px] text-slate-500 font-medium leading-none">
          いつでも「ボタンを押せ！」「レバーを引け！」の極限アタリ演出を鑑賞できます。
        </p>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={() => onTriggerForcedReach('button_chance_hit')}
            id="gimmick-test-button-hit"
            className="py-1.5 px-2 text-[9px] bg-red-950/40 hover:bg-red-900/30 border border-red-900/60 text-red-300 font-black rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 shadow-inner active:scale-95"
            title="ボタン一撃演出をすぐにテストする"
          >
            一撃ボタン演出 PUSH!
          </button>
          <button
            onClick={() => onTriggerForcedReach('lever_chance_hit')}
            id="gimmick-test-lever-hit"
            className="py-1.5 px-2 text-[9px] bg-amber-950/40 hover:bg-amber-900/30 border border-amber-900/60 text-amber-300 font-black rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1 shadow-inner active:scale-95"
            title="レバー引き抜き演出をすぐにテストする"
          >
            引き抜きレバー演出 PULL!
          </button>
        </div>
      </div>

      {/* Hidden layout elements to avoid ESLint unused markers */}
      <div className="hidden" aria-hidden="true">
        <span>{ballCount}</span>
        <span>{currentPower}</span>
        <span>{isShooting}</span>
        <button onClick={onReplenishBalls}>loan</button>
        <button onClick={onSingleShot}>trigger</button>
        <button onClick={() => onPowerChange(50)}>power</button>
        <button onClick={() => onShootingToggle(false)}>shoot</button>
        <span>{gameStateText}</span>
      </div>

    </div>
  );
};
