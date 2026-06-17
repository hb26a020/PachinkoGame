/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Flame, Zap, HelpCircle, Trophy, RefreshCw } from 'lucide-react';
import { sfx } from '../utils/audio';

interface LcdScreenProps {
  reels: [number, number, number];
  spinState: 'idle' | 'spinning' | 'reach' | 'climax' | 'jackpot' | 'rush_intro' | 'rush';
  reachType: 'none' | 'normal' | 'fire' | 'thunder' | 'button_chance' | 'button_chance_hit' | 'lever_chance_hit';
  horyuuCount: number; // 0 to 4
  onTriggerButton: () => void;
  jackpotProgress: number; // For rendering active payout bar/timer
  currentRound: number; // Standard jackpots have 10 rounds
  consecutiveJp: number;
  isRushActive: boolean;
}

export const LcdScreen: React.FC<LcdScreenProps> = ({
  reels,
  spinState,
  reachType,
  horyuuCount,
  onTriggerButton,
  jackpotProgress,
  currentRound,
  consecutiveJp,
  isRushActive,
}) => {
  const [pulseColor, setPulseColor] = useState<string>('border-blue-600');
  const [buttonActive, setButtonActive] = useState<boolean>(false);
  const [buttonPressedCount, setButtonPressedCount] = useState<number>(0);

  // Generate Horyuu Stock indicators
  // Give them premium item types based on index to simulate sakiyomi warning
  const renderHoryuu = () => {
    const indicators = [];
    for (let i = 0; i < 4; i++) {
      const active = i < horyuuCount;
      // Sakiyomi colors: 1st is normal, 2nd is Green, 3rd is Red (Hot!), 4th is Rainbow!
      let colorClass = 'bg-slate-800 border-slate-700';
      if (active) {
        if (i === 0) colorClass = 'bg-blue-500 shadow-blue-500/50 shadow-md animate-pulse';
        else if (i === 1) colorClass = 'bg-emerald-500 shadow-emerald-500/50 shadow-md';
        else if (i === 2) colorClass = 'bg-rose-500 shadow-rose-500/50 shadow-md animate-ping';
        else colorClass = 'bg-amber-400 shadow-amber-500/50 shadow-md animate-bounce';
      }
      indicators.push(
        <div
          key={i}
          className={`h-3.5 w-3.5 rounded-full border ${colorClass} transition-all duration-300`}
          title={`保留ストック ${i + 1}`}
        />
      );
    }
    return indicators;
  };

  // Change borders and visual glows based on states
  useEffect(() => {
    if (spinState === 'jackpot') {
      setPulseColor('border-red-500 shadow-red-500/60');
    } else if (spinState === 'rush' || spinState === 'rush_intro') {
      setPulseColor('border-purple-500 shadow-purple-500/60');
    } else if (spinState === 'reach' || spinState === 'climax') {
      setPulseColor('border-orange-500 shadow-orange-500/60');
    } else if (spinState === 'spinning') {
      setPulseColor('border-cyan-500 shadow-cyan-500/60');
    } else {
      setPulseColor('border-slate-800');
    }

    if ((reachType === 'button_chance' || reachType === 'button_chance_hit') && spinState === 'climax') {
      setButtonActive(true);
    } else {
      setButtonActive(false);
      setButtonPressedCount(0);
    }
  }, [spinState, reachType]);

  const handlePush = () => {
    if (!buttonActive) return;
    sfx.playButtonPress();
    setButtonPressedCount((prev) => prev + 1);
    onTriggerButton();
  };

  return (
    <div
      className={`absolute top-[182px] left-[117px] w-[166px] h-[166px] bg-slate-950 rounded border-2 overflow-hidden flex flex-col justify-between p-2 select-none ${pulseColor} transition-all duration-300 z-10`}
      id="lcd-center-display"
    >
      {/* Upper Mode Banner */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1 text-[9px] font-sans font-bold">
        {isRushActive ? (
          <span className="text-red-500 animate-pulse tracking-wide font-black">🔥 ULTRA HYPER RUSH 🔥</span>
        ) : (
          <span className="text-emerald-400 tracking-wider">★ CYBER MATRIX (通常) ★</span>
        )}
        {consecutiveJp > 0 && (
          <span className="text-yellow-400 font-black bg-red-950/80 border border-red-500/30 px-1.5 rounded text-[8px] animate-pulse">
            {consecutiveJp} FEVER
          </span>
        )}
      </div>

      {/* Screen Core Visual Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden my-1">
        
        {/* FLASH BACKGROUND MATRIX */}
        <AnimatePresence>
          {spinState === 'jackpot' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="absolute inset-0 bg-gradient-to-t from-red-600 via-yellow-500 to-red-600 z-0"
            />
          )}
          {(spinState === 'rush' || spinState === 'rush_intro') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="absolute inset-0 bg-gradient-to-r from-purple-800 via-pink-600 to-indigo-800 z-0"
            />
          )}
        </AnimatePresence>

        {/* 1. STATE: SPINNING / IDLE / REACH */}
        {(spinState === 'idle' || spinState === 'spinning' || spinState === 'reach' || spinState === 'climax') && (
          <div className="relative flex flex-col items-center justify-center w-full h-full z-10">
            
            {/* Reach indicator overlay */}
            {spinState === 'reach' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                className="absolute top-1 text-[11px] font-extrabold text-red-500 bg-red-950/80 px-2 py-0.5 rounded border border-red-500 tracking-widest z-20 shadow-md"
              >
                リーチ！
              </motion.div>
            )}

            {spinState === 'climax' && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: [1, 1.05, 1], opacity: 1 }}
                className="absolute top-0.5 text-[10px] font-black leading-tight text-center text-rose-500 bg-black/95 px-2 py-0.5 rounded border border-rose-600 animate-pulse tracking-wide z-20"
              >
                {reachType === 'button_chance_hit' ? (
                  <span className="text-red-500 font-extrabold block text-[8px]">当たる寸前にボタンを押せ！</span>
                ) : reachType === 'lever_chance_hit' ? (
                  <span className="text-yellow-400 font-extrabold block text-[8px]">当たる寸前にレバーを引け！</span>
                ) : reachType === 'button_chance' ? (
                  '▼ ボタンPUSH ▼'
                ) : (
                  '🔥🔥 激熱 🔥🔥'
                )}
              </motion.div>
            )}

            {/* Three Spin Digits */}
            <div className="flex gap-1.5 items-center justify-center w-full">
              {reels.map((val, idx) => {
                const isSpinningThis =
                  spinState === 'spinning' ||
                  (spinState === 'reach' && idx === 1) || // center reel slow down
                  (spinState === 'climax' && idx === 1); // center reel intense roll

                return (
                  <div
                    key={idx}
                    className={`relative w-11 h-14 bg-slate-900/90 border border-slate-700 rounded-lg flex items-center justify-center ${
                      spinState === 'reach' && idx !== 1 ? 'border-amber-400 bg-amber-950/20' : ''
                    }`}
                  >
                    {isSpinningThis ? (
                      // Rhythmic moving reel text
                      <motion.div
                        animate={{ y: [-15, 15] }}
                        transition={{
                          repeat: Infinity,
                          duration: idx === 1 ? 0.35 : 0.15,
                          ease: 'linear',
                        }}
                        className="text-2xl font-black font-mono text-cyan-400 italic text-center select-none"
                      >
                        {Math.floor(Math.random() * 10)}
                      </motion.div>
                    ) : (
                      // Static digit with custom animation entry
                      <motion.span
                        key={val}
                        initial={{ scale: 0.6, y: -5 }}
                        animate={{ scale: 1, y: 0 }}
                        className={`text-2xl font-black font-mono leading-none tracking-tight italic select-none ${
                          val === 7
                            ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]'
                            : val % 2 !== 0
                            ? 'text-pink-500'
                            : 'text-white'
                        }`}
                      >
                        {val}
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CLIMAX SPECIAL STAGES GRAPHICS */}
            {spinState === 'climax' && (
              <div className="absolute inset-x-0 bottom-1 flex flex-col items-center justify-center gap-0.5">
                {reachType === 'fire' && (
                  <div className="flex items-center text-red-500 gap-0.5 text-[8px] font-bold uppercase tracking-wider animate-pulse bg-red-950/30 px-1 rounded border border-red-900">
                    <Flame className="w-2.5 h-2.5" /> 灼熱炎カットイン
                  </div>
                )}
                {reachType === 'thunder' && (
                  <div className="flex items-center text-yellow-400 gap-0.5 text-[8px] font-bold uppercase tracking-wider animate-pulse bg-yellow-950/30 px-1 rounded border border-yellow-800">
                    <Zap className="w-2.5 h-2.5 animate-bounce" /> 暗黒サンダー波
                  </div>
                )}
                {reachType === 'button_chance_hit' && (
                  <div className="flex items-center text-red-400 gap-0.5 text-[8px] font-extrabold uppercase tracking-widest animate-pulse bg-red-950/90 px-1.5 py-0.5 rounded border border-red-600 shadow-sm">
                    ボタン一撃必殺
                  </div>
                )}
                {reachType === 'lever_chance_hit' && (
                  <div className="flex items-center text-yellow-400 gap-0.5 text-[8px] font-extrabold uppercase tracking-widest animate-pulse bg-yellow-950/90 px-1.5 py-0.5 rounded border border-amber-500 shadow-sm">
                    レバー引き抜け！
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. STATE: JACKPOT (ATARI! FEVER) */}
        {spinState === 'jackpot' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center w-full h-full text-center z-10 bg-slate-950/80 p-1.5 rounded-lg border border-red-500/50"
          >
            <Trophy className="w-8 h-8 text-yellow-400 mb-0.5 animate-bounce" />
            <motion.h2
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="text-sm font-black text-yellow-300 uppercase tracking-widest leading-none drop-shadow-md"
            >
              大当り!!
            </motion.h2>
            <p className="text-[9px] font-bold text-white mt-1">ROUND {currentRound}/10</p>
            
            {/* Round progress bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 border border-slate-700">
              <div
                className="bg-red-500 shadow-lg justify-end h-full transition-all duration-100"
                style={{ width: `${jackpotProgress}%` }}
              />
            </div>
            <p className="text-[8px] text-yellow-400 font-mono mt-0.5">アタッカーを狙え！</p>
          </motion.div>
        )}

        {/* 3. STATE: RUSH INTRO (Kakuhen Transition) */}
        {spinState === 'rush_intro' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center w-full h-full text-center z-10 p-1"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            >
              <RefreshCw className="w-8 h-8 text-pink-400" />
            </motion.div>
             <h1 className="text-md font-black text-rose-500 mt-2 uppercase tracking-wide animate-pulse shadow-rose-950">
              【FEVER ENERGY】臨界突破
            </h1>
            <p className="text-[8px] text-slate-200 leading-tight">
              電サポ高確率ラッシュ！<br />
              高確率変動: 1/30
            </p>
          </motion.div>
        )}

        {/* 4. STATE: RUSH ACTIVE TIMER LOOP */}
        {spinState === 'rush' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center w-full h-full text-center z-10"
          >
            <span className="text-[8px] bg-red-950/80 border border-red-500 text-red-300 px-1.5 py-0.5 rounded font-black tracking-widest animate-pulse">
              MATRIX CHARGED
            </span>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-md font-black italic tracking-tighter text-yellow-400 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)] my-1"
            >
              ★ ULTRA HYPER RUSH ★
            </motion.div>
            <p className="text-[8px] text-emerald-400 font-extrabold uppercase tracking-widest">
              極限の興奮、大当りをもぎ取れ！
            </p>
          </motion.div>
        )}

        {/* OVERLAY: INTERACTIVE PHYSICAL PUSH BUTTON */}
        <AnimatePresence>
          {buttonActive && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-center z-30"
            >
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                onClick={handlePush}
                id="physical-push-button"
                className="px-3 py-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 rounded-full border-2 border-amber-300 text-[10px] font-black text-white shadow-xl flex items-center justify-center gap-1 hover:brightness-110 active:brightness-90 cursor-pointer"
              >
                <HelpCircle className="w-3 h-3 text-yellow-200 animate-spin" /> PUSH! ({buttonPressedCount})
              </motion.button>
              <span className="text-[7px] text-white/80 bg-black/50 px-1 rounded mt-0.5">連打して当りを掴め！</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Bottom Retention Horyuu Stock Display */}
      <div className="flex flex-col items-center justify-center border-t border-white/10 pt-1 mt-auto">
        <div className="flex gap-1.5 justify-center items-center">
          {renderHoryuu()}
        </div>
        <div className="text-[7px] font-mono font-bold tracking-widest text-slate-500 mt-0.5">
          RETAINED STANDBY (保留)
        </div>
      </div>
    </div>
  );
};
