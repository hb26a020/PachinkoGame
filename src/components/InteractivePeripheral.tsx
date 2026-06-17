/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'motion/react';
import { RotateCcw, AlertTriangle, Play, Sparkles } from 'lucide-react';
import { sfx } from '../utils/audio';

interface InteractivePeripheralProps {
  spinState: 'idle' | 'spinning' | 'reach' | 'climax' | 'jackpot' | 'rush_intro' | 'rush';
  reachType: 'none' | 'normal' | 'fire' | 'thunder' | 'button_chance' | 'button_chance_hit' | 'lever_chance_hit';
  onButtonPress: () => void;
  onLeverPull: () => void;
}

export const InteractivePeripheral: React.FC<InteractivePeripheralProps> = ({
  spinState,
  reachType,
  onButtonPress,
  onLeverPull,
}) => {
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [leverPosition, setLeverPosition] = useState(0); // 0 to 100 representing pull percentage
  const [isLeverPulledDone, setIsLeverPulledDone] = useState(false);

  // Motion value for smooth physical dragging of the lever
  const dragY = useMotionValue(0);
  // Transform drag Y pixel offsets into rotational angle and lever height
  const leverAngle = useTransform(dragY, [0, 85], [0, 48]);
  const handleScale = useTransform(dragY, [0, 85], [1.0, 0.85]);

  const leverControls = useAnimation();

  // Reset states when reachType changes
  useEffect(() => {
    setIsLeverPulledDone(false);
    dragY.set(0);
  }, [reachType]);

  const handlePhysicalButtonPress = () => {
    setIsButtonPressed(true);
    sfx.playButtonPress();
    onButtonPress();
    setTimeout(() => setIsButtonPressed(false), 150);
  };

  // Helper trigger for button press / lever pull action on raw click of the handle
  const handleDirectLeverPull = async () => {
    if (isLeverPulledDone) return;
    setIsLeverPulledDone(true);
    sfx.playLaunchSqueak(); // trigger pull mechanical snap tone

    // Animate the lever smoothly pulling down and bouncing back
    await leverControls.start({ y: 80, transition: { duration: 0.25, ease: 'easeOut' } });
    onLeverPull();
    await leverControls.start({ y: 0, transition: { duration: 0.35, type: 'spring', stiffness: 200, damping: 12 } });
    setIsLeverPulledDone(false);
  };

  // Listen to drag transition to trigger completed lever state
  useEffect(() => {
    return dragY.onChange((latest) => {
      const percentage = Math.min(100, Math.max(0, (latest / 80) * 100));
      setLeverPosition(percentage);
      if (latest >= 75 && !isLeverPulledDone) {
        setIsLeverPulledDone(true);
        sfx.playButtonPress(); // mechanical trigger sound
        onLeverPull();
        // Shake feedback
        const container = document.getElementById('pachinko-interactive-hub');
        if (container) {
          container.classList.add('animate-bounce');
          setTimeout(() => container.classList.remove('animate-bounce'), 320);
        }
      }
    });
  }, [dragY, isLeverPulledDone, onLeverPull]);

  // Determine indicator state
  const isButtonActive = reachType === 'button_chance_hit' && spinState === 'climax';
  const isLeverActive = reachType === 'lever_chance_hit' && spinState === 'climax';

  return (
    <div
      id="pachinko-interactive-hub"
      className="w-full max-w-[400px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 border-4 border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 select-none relative overflow-hidden transition-all duration-300"
    >
      {/* Carbon fiber style textured background element */}
      <div className="absolute inset-0 opacity-10 bg-grid-pattern pointer-events-none" />

      {/* Dynamic LED top rail */}
      <div className="flex justify-between items-center w-full bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 relative z-10">
        <div className="flex gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${isButtonActive ? 'bg-red-500 animate-ping' : isLeverActive ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
          <span className="text-[10px] font-mono font-black text-slate-400 tracking-wider">PERIPHERAL MODULE</span>
        </div>
        <div className="flex items-center gap-1">
          {isButtonActive && <span className="text-[9px] font-black tracking-tight text-red-500 animate-pulse font-sans">【ボタン待機中】</span>}
          {isLeverActive && <span className="text-[9px] font-black tracking-tight text-amber-400 animate-pulse font-sans">【レバー引け待機中】</span>}
          {!isButtonActive && !isLeverActive && <span className="text-[8px] font-mono text-slate-600">STANDBY READY</span>}
        </div>
      </div>

      {/* Main interactive center rows */}
      <div className="grid grid-cols-2 gap-4 relative z-10 h-36 items-center">
        
        {/* ROW LEFT: BIG GLOWING PUSH BUTTON */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">PUSH BUTTON</span>
          
          <div className="relative">
            {/* Pulsing ring behind button */}
            {isButtonActive && (
              <div className="absolute -inset-3.5 bg-gradient-to-r from-red-600 to-pink-500 rounded-full blur opacity-75 animate-ping" />
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              animate={{
                scale: isButtonActive ? [1, 1.08, 1] : 1,
              }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              onClick={handlePhysicalButtonPress}
              id="peripheral-red-button"
              className={`relative h-20 w-20 rounded-full flex flex-col items-center justify-center border-4 select-none cursor-pointer text-center font-bold tracking-wider leading-none shadow-2xl transition-all duration-150 ${
                isButtonActive
                  ? 'bg-gradient-to-b from-red-500 via-rose-600 to-red-800 border-yellow-400 text-white shadow-red-500/50'
                  : 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-slate-600 text-slate-400'
              }`}
              style={{
                boxShadow: isButtonActive ? '0 0 20px 5px rgba(239, 68, 68, 0.45)' : 'none',
                transform: isButtonPressed ? 'translateY(4px) scale(0.95)' : 'none',
              }}
            >
              {/* Internal shiny circle */}
              <div className="absolute inset-1 rounded-full border border-white/20 bg-transparent flex flex-col items-center justify-center">
                {isButtonActive ? (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 0.4 }}
                    className="font-black text-xs uppercase text-yellow-300 italic tracking-wider drop-shadow-md"
                  >
                    押せ!!
                  </motion.div>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">PUSH</span>
                )}
                <span className="text-[8px] text-white/40 block mt-0.5">CHANCE</span>
              </div>
            </motion.button>
          </div>
        </div>

        {/* ROW RIGHT: INTUATIVE ANALOG PULL LEVER */}
        <div className="flex flex-col items-center justify-center border-l border-slate-800">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">PULL LEVER</span>

          <div className="relative w-full flex flex-col items-center justify-center h-28">
            {/* Background guide channel */}
            <div className="w-8 h-20 bg-slate-950/90 rounded-full border border-slate-800 flex flex-col justify-between items-center py-1.5 relative">
              
              {/* Highlight background lines pointing down */}
              {isLeverActive && (
                <div className="absolute inset-0 flex flex-col justify-around text-center items-center pointer-events-none opacity-80">
                  <span className="text-amber-500 text-[10px] animate-bounce">▼</span>
                  <span className="text-amber-500 text-[10px] animate-bounce delay-100">▼</span>
                </div>
              )}

              {/* Glowing active outline */}
              {isLeverActive && (
                <div className="absolute -inset-1 border-2 border-amber-400 rounded-full opacity-60 animate-pulse pointer-events-none" />
              )}

              {/* Lever visual metallic stem and ball representing dragging physical hand control */}
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 85 }}
                dragElastic={0.1}
                animate={leverControls}
                style={{ y: dragY }}
                onDragStart={() => {
                  sfx.playShot(); // small trigger start click
                }}
                onDragEnd={() => {
                  // If release without triggering full swing
                  if (dragY.get() < 75) {
                    leverControls.start({ y: 0, transition: { duration: 0.25, type: 'spring', stiffness: 200 } });
                  } else {
                    // Pull succeeded! Snap back
                    setTimeout(() => {
                      leverControls.start({ y: 0, transition: { duration: 0.3, type: 'spring' } });
                    }, 100);
                  }
                }}
                className="absolute top-1 left-1 w-6 h-12 flex flex-col items-center cursor-ns-resize z-25"
                title="ドラッグ、またはクリックで引く"
              >
                {/* 1. Stem joint (lever shaft) */}
                <div className="w-1.5 h-6 bg-gradient-to-r from-slate-400 via-white to-slate-400 border border-slate-500" />
                
                {/* 2. Interactive handle grip ball */}
                <motion.div
                  onClick={handleDirectLeverPull}
                  style={{ scale: handleScale }}
                  className={`w-5.5 h-5.5 rounded-full flex items-center justify-center shadow-lg border cursor-pointer ${
                    isLeverActive
                      ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 border-yellow-300 animate-pulse'
                      : 'bg-gradient-to-tr from-slate-500 via-slate-400 to-slate-600 border-slate-400'
                  }`}
                >
                  <div className="w-1.5 h-1.5 bg-white/70 rounded-full" />
                </motion.div>
                
              </motion.div>
            </div>

            {/* Quick action button for easy playability on small touch pads */}
            <button
              onClick={handleDirectLeverPull}
              disabled={!isLeverActive}
              id="lever-easy-pull-btn"
              className="mt-2 text-[8px] bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest leading-none disabled:opacity-20"
            >
              CLICK TO PULL
            </button>
          </div>
        </div>

      </div>

      {/* Cinematic warnings & instructions panel */}
      {spinState === 'climax' ? (
        <div className="bg-slate-950 rounded-xl p-2.5 border border-red-950/60 flex flex-col gap-1 text-center justify-center relative z-15">
          {reachType === 'lever_chance_hit' ? (
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="flex flex-col items-center justify-center gap-1"
            >
              <h2 className="text-yellow-400 font-black text-sm uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-yellow-500 animate-bounce" />
                当たる寸前にレバーを引け！
              </h2>
              <p className="text-[10px] text-slate-300 font-bold">右側の球体がレバーです！下に全力で引いてください！</p>
            </motion.div>
          ) : reachType === 'button_chance_hit' ? (
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="flex flex-col items-center justify-center gap-1"
            >
              <h2 className="text-red-500 font-black text-sm uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-500 animate-ping" />
                当たる寸前にボタンを押せ！
              </h2>
              <p className="text-[10px] text-slate-300 font-bold">左側のボタンを叩き込め！高揚のアタリが目前！</p>
            </motion.div>
          ) : (
            <div className="text-[10px] text-slate-500 font-semibold py-1">クライマックス変動！激熱に期待せよ！</div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950/50 rounded-lg p-2 text-center text-[9px] text-slate-600 font-medium">
          リーチ突入時に、連打ボタンや引き抜きレバーイベントがリアルタイム稼働！
        </div>
      )}

    </div>
  );
};
