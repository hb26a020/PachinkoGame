/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { SpecType, MachineSpec, JackpotHistory, ReachType } from './types';
import { Board } from './components/Board';
import { LcdScreen } from './components/LcdScreen';
import { ControlPanel } from './components/ControlPanel';
import { InteractivePeripheral } from './components/InteractivePeripheral';
import { sfx } from './utils/audio';
import { HelpCircle, Coins, Gamepad2, Info, ArrowUpRight, Award, Trophy, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Machine specs definitions
const MACHINE_SPECS: Record<SpecType, MachineSpec> = {
  SWEET: {
    id: 'SWEET',
    name: 'CRA CYBER SWEET (甘デジ)',
    jpProbability: 99,
    rushJpProbability: 30,
    rushRate: 0.5,
    rushEscapeRate: 0.15, // 85% continuity
    payoutNormal: 300,
    payoutFever: 600,
    description: '大当り確率1/99の遊びやすいスペック。当りやすさはピカイチで、演出や高確率RUSHを手軽に遊んでみたい方に最適！',
  },
  MIDDLE: {
    id: 'MIDDLE',
    name: 'CR NEON FUTURE (ミドル)',
    jpProbability: 199,
    rushJpProbability: 35,
    rushRate: 0.55,
    rushEscapeRate: 0.12, // 88% continuity
    payoutNormal: 500,
    payoutFever: 1000,
    description: '大当り確率1/199のライトミドルスペック。出玉・チャンスのバランスが良く、最も実機らしいゲーム性が楽しめます。',
  },
  MAX: {
    id: 'MAX',
    name: 'CR CYBER RUSH-Z (マックス)',
    jpProbability: 319,
    rushJpProbability: 39,
    rushRate: 0.6,
    rushEscapeRate: 0.10, // 90% continuity
    payoutNormal: 750,
    payoutFever: 1500,
    description: '大当り確率1/319.7のハイリスク・ハイリターン仕様！一撃のラッシュ連チャン性・出玉が爆発的で、実機の緊張感も最高峰。',
  },
};

export default function App() {
  // Console/Storage State
  const [ballCount, setBallCount] = useState<number>(() => {
    const saved = localStorage.getItem('pachinko_balls');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [investedCash, setInvestedCash] = useState<number>(() => {
    const saved = localStorage.getItem('pachinko_invested');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [totalWon, setTotalWon] = useState<number>(() => {
    const saved = localStorage.getItem('pachinko_won');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [ballsFiredCount, setBallsFiredCount] = useState<number>(() => {
    const saved = localStorage.getItem('pachinko_fired');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [autoTuningEnabled, setAutoTuningEnabled] = useState<boolean>(true);
  const [totalSpins, setTotalSpins] = useState<number>(0);
  const [totalJackpots, setTotalJackpots] = useState<number>(0);
  const [consecutiveWins, setConsecutiveWins] = useState<number>(0);
  const [historyList, setHistoryList] = useState<JackpotHistory[]>([]);

  // Machine Configuration
  const [selectedSpec, setSelectedSpec] = useState<MachineSpec>(MACHINE_SPECS.MIDDLE);

  // Manual & Auto Shooting States
  const [shootingPower, setShootingPower] = useState<number>(65); // Default 65% power (Soshiki-uchi)
  const [isShooting, setIsShooting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // LCD Screen & Spin Engine State
  const [reels, setReels] = useState<[number, number, number]>([3, 5, 2]);
  const [spinState, setSpinState] = useState<'idle' | 'spinning' | 'reach' | 'climax' | 'jackpot' | 'rush_intro' | 'rush'>('idle');
  const [reachType, setReachType] = useState<ReachType>('none');
  const [horyuuCount, setHoryuuCount] = useState<number>(0);
  const [isRushActive, setIsRushActive] = useState<boolean>(false);

  // Climax / Interactive Pending Target variables
  const [interactiveHitTarget, setInteractiveHitTarget] = useState<{
    activatesRush: boolean;
    mainDigit: number;
    timeoutId: any;
  } | null>(null);

  // Jackpot Live Progress
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [attackerScoreCount, setAttackerScoreCount] = useState<number>(0);
  const [jackpotSpinsAtStart, setJackpotSpinsAtStart] = useState<number>(0);
  const [isAttackerOpen, setIsAttackerOpen] = useState<boolean>(false);

  // Tutorial State Active tab
  const [activeTab, setActiveTab] = useState<'basic' | 'glossary'>('basic');
  const [isRulebookOpen, setIsRulebookOpen] = useState<boolean>(false);

  // Sync core points to local storage
  useEffect(() => {
    localStorage.setItem('pachinko_balls', ballCount.toString());
    localStorage.setItem('pachinko_invested', investedCash.toString());
    localStorage.setItem('pachinko_won', totalWon.toString());
    localStorage.setItem('pachinko_fired', ballsFiredCount.toString());
  }, [ballCount, investedCash, totalWon, ballsFiredCount]);

  // Audio synthesizer mute alignment
  const handleMuteToggle = () => {
    const muted = sfx.toggleMute();
    setIsMuted(muted);
  };

  // Spend 1 ball for shooting
  const handleBallFired = () => {
    setBallCount((prev) => Math.max(0, prev - 1));
    setBallsFiredCount((prev) => prev + 1);
  };

  // Award balls from traditional pockets of attacker entries
  const handleAwardBalls = (amount: number) => {
    setBallCount((prev) => prev + amount);
    setTotalWon((prev) => prev + amount);
  };

  // Handle successful climax resolve (button or lever)
  const handleClimaxSuccess = (digit: number, activatesRush: boolean) => {
    setInteractiveHitTarget(null);
    setReels([digit, digit, digit]);
    sfx.playJackpotFanfare();
    triggerJackpotStart(activatesRush);
  };

  // Handle action triggers from interactive peripherals
  const handleButtonPressAction = () => {
    // Visual vibration on center LCD screen
    const container = document.getElementById('lcd-center-display');
    if (container) {
      container.classList.add('animate-bounce');
      setTimeout(() => container.classList.remove('animate-bounce'), 300);
    }

    if (reachType === 'button_chance_hit' && spinState === 'climax' && interactiveHitTarget) {
      clearTimeout(interactiveHitTarget.timeoutId);
      handleClimaxSuccess(interactiveHitTarget.mainDigit, interactiveHitTarget.activatesRush);
    } else {
      // standard digital screen button bounce helper
      handlePushChanceClick();
    }
  };

  const handleLeverPullAction = () => {
    // Heavy sound clunk and impact
    sfx.playLaunchSqueak();
    const container = document.getElementById('lcd-center-display');
    if (container) {
      container.classList.add('animate-ping');
      setTimeout(() => container.classList.remove('animate-ping'), 350);
    }

    if (reachType === 'lever_chance_hit' && spinState === 'climax' && interactiveHitTarget) {
      clearTimeout(interactiveHitTarget.timeoutId);
      handleClimaxSuccess(interactiveHitTarget.mainDigit, interactiveHitTarget.activatesRush);
    }
  };

  // Entering Heso start hole: triggers a spin!
  const handleHesoGet = () => {
    sfx.playHeso();
    setHoryuuCount((prev) => {
      if (prev < 4) {
        return prev + 1;
      }
      return prev;
    });
  };

  // Scoring in Attacker (only happens during Jackpot)
  const handleAttackerScore = () => {
    sfx.playAttackerScore();
    setAttackerScoreCount((prev) => {
      const nextScore = prev + 1;
      // Real mechanical rule: 10 counts per round closes the door and opens next!
      if (nextScore >= 10) {
        sfx.playHeso(); // happy tone transition
        if (currentRound < 10) {
          setCurrentRound((r) => r + 1);
          return 0; // reset for next round
        } else {
          // Finished all 10 rounds! Finish Jackpot
          handleJackpotComplete();
        }
      }
      return nextScore;
    });
  };

  // Main Spin controller: Pops horyuu queued items
  useEffect(() => {
    if (spinState !== 'idle' && spinState !== 'rush') return;
    if (horyuuCount <= 0) return;

    // Pop stock spinner
    setHoryuuCount((prev) => Math.max(0, prev - 1));
    setTotalSpins((prev) => prev + 1);

    // Roll for jackpot
    // Rush has higher possibility (1/30 to 1/39), Normal has standard spec possibility
    const probLimit = isRushActive ? selectedSpec.rushJpProbability : selectedSpec.jpProbability;
    const isHit = Math.random() < 1 / probLimit;

    // Initialize LCD spinning states
    setSpinState('spinning');
    let spinDuration = isRushActive ? 800 : 1550; // Speed-rush features short spins!

    // Audio spinning ticks
    let tickCount = 0;
    const soundInterval = setInterval(() => {
      sfx.playSpinTick(tickCount++);
    }, 120);

    setTimeout(() => {
      clearInterval(soundInterval);

      if (isHit) {
        // JACKPOT !
        // Roll if it triggers Fever/Rush (Odd digits like 7 or 3 trigger Rush, Even digits normal)
        const activatesRush = Math.random() < selectedSpec.rushRate;
        const mainDigit = activatesRush ? [3, 7, 1, 5, 9][Math.floor(Math.random() * 5)] : [2, 4, 6, 8][Math.floor(Math.random() * 4)];
        
        // Show reach first
        setSpinState('reach');
        setReels([mainDigit, Math.floor(Math.random() * 10), mainDigit]); // Match left & right to trigger reach!

        // Generate intense sub-reaches if climax (include high-excitation lever and button climax)
        const reaches: Array<ReachType> = ['normal', 'fire', 'thunder', 'button_chance', 'button_chance_hit', 'lever_chance_hit'];
        const chosenReach = reaches[Math.floor(Math.random() * reaches.length)];
        setReachType(chosenReach);

        const sirenInterval = setInterval(() => {
          sfx.playReachSiren(tickCount++);
        }, 120);

        setTimeout(() => {
          clearInterval(sirenInterval);
          if (chosenReach !== 'normal') {
            setSpinState('climax');
          }

          if (chosenReach === 'button_chance_hit' || chosenReach === 'lever_chance_hit') {
            // Setup Climax interactive waiting state with automated pass-through limit
            const fallthroughId = setTimeout(() => {
              handleClimaxSuccess(mainDigit, activatesRush);
            }, 5500);

            setInteractiveHitTarget({
              activatesRush,
              mainDigit,
              timeoutId: fallthroughId,
            });
          } else {
            // Complete reveal on standard timeline
            setTimeout(() => {
              setReels([mainDigit, mainDigit, mainDigit]);
              sfx.playJackpotFanfare();
              triggerJackpotStart(activatesRush);
            }, 2450);
          }

        }, 1500);

      } else {
        // HAZURE (MISS)
        // Check if we trigger a decorative decoy reach for extra thrill (approx 10% chance)
        const isDecoyReach = Math.random() < 0.12;
        if (isDecoyReach) {
          const mainDigit = Math.floor(Math.random() * 9) + 1;
          let centerDigit = Math.floor(Math.random() * 10);
          while (centerDigit === mainDigit) {
            centerDigit = Math.floor(Math.random() * 10);
          }
          setSpinState('reach');
          setReachType('normal');
          setReels([mainDigit, centerDigit, mainDigit]);

          const decoySiren = setInterval(() => {
            sfx.playReachSiren(tickCount++);
          }, 150);

          setTimeout(() => {
            clearInterval(decoySiren);
            // Miss final
            setReels([mainDigit, centerDigit, mainDigit]);
            setSpinState(isRushActive ? 'rush' : 'idle');
            setReachType('none');
          }, 2200);

        } else {
          // Regular boring quick stop
          let d1 = Math.floor(Math.random() * 10);
          let d2 = Math.floor(Math.random() * 10);
          let d3 = Math.floor(Math.random() * 10);
          // ensure not hitting jackpot
          if (d1 === d2 && d2 === d3) {
            d2 = (d2 + 1) % 10;
          }
          setReels([d1, d2, d3]);
          setSpinState(isRushActive ? 'rush' : 'idle');
          setReachType('none');
        }
      }

    }, spinDuration);

  }, [horyuuCount, spinState, isRushActive, selectedSpec]);

  // Activate the visual and physical jackpot cycle
  const triggerJackpotStart = (activatesRush: boolean) => {
    setSpinState('jackpot');
    setCurrentRound(1);
    setAttackerScoreCount(0);
    setJackpotSpinsAtStart(totalSpins);
    setIsAttackerOpen(true);

    // Save starting indicator on Rush
    localStorage.setItem('pachinko_jackpot_rush_dest', activatesRush ? 'YES' : 'NO');
  };

  // Triggered when push button clicked during reach climax
  const handlePushChanceClick = () => {
    // Shaking physical action
    const container = document.getElementById('lcd-center-display');
    if (container) {
      container.classList.add('animate-bounce');
      setTimeout(() => container.classList.remove('animate-bounce'), 300);
    }
  };

  // Force a test reach for user to enjoy!
  const triggerForcedReachTest = (forcedType: 'button_chance_hit' | 'lever_chance_hit') => {
    if (spinState !== 'idle' && spinState !== 'rush') {
      alert('現在変動中、または大当り中です。終了してからお試しください。');
      return;
    }
    setTotalSpins((prev) => prev + 1);
    
    // Force a hit configuration
    setSpinState('spinning');
    const activatesRush = Math.random() < selectedSpec.rushRate;
    const mainDigit = activatesRush ? [3, 7, 1, 5, 9][Math.floor(Math.random() * 5)] : [2, 4, 6, 8][Math.floor(Math.random() * 4)];

    let tickCount = 0;
    const soundInterval = setInterval(() => {
      sfx.playSpinTick(tickCount++);
    }, 120);

    setTimeout(() => {
      clearInterval(soundInterval);
      setSpinState('reach');
      setReels([mainDigit, Math.floor(Math.random() * 10), mainDigit]);
      setReachType(forcedType);

      const sirenInterval = setInterval(() => {
        sfx.playReachSiren(tickCount++);
      }, 120);

      setTimeout(() => {
        clearInterval(sirenInterval);
        setSpinState('climax');

        // Setup the climax waiting timeout-fallthrough
        const fallthroughId = setTimeout(() => {
          handleClimaxSuccess(mainDigit, activatesRush);
        }, 5500);

        setInteractiveHitTarget({
          activatesRush,
          mainDigit,
          timeoutId: fallthroughId,
        });

      }, 1500);

    }, 1000);
  };

  // Finishes jackpot: processes payouts and handles Kakuhen state
  const handleJackpotComplete = () => {
    setIsAttackerOpen(false);

    const destRush = localStorage.getItem('pachinko_jackpot_rush_dest') === 'YES';
    const totalAwarded = currentRound * 10 * 15; // Approx balls paid out

    setTotalJackpots((prev) => prev + 1);

    // Determine history registry
    const nextHistory: JackpotHistory = {
      spinCount: totalSpins - jackpotSpinsAtStart,
      type: destRush ? 'RUSH_STARTER' : isRushActive ? 'FEVER' : 'NORMAL',
      payout: totalAwarded,
      time: new Date().toLocaleTimeString(),
      consecutiveCount: destRush || isRushActive ? consecutiveWins + 1 : 0,
    };

    setHistoryList((prev) => [nextHistory, ...prev].slice(0, 15));

    if (destRush || isRushActive) {
      // Retain or trigger Rush!
      setConsecutiveWins((prev) => prev + 1);
      setIsRushActive(true);
      setSpinState('rush_intro');
      sfx.playRushActivation();

      setTimeout(() => {
        setSpinState('rush');
      }, 3000);
    } else {
      // Regular end, check surprise rush (10% saving fallback)
      const saveSurprise = Math.random() < 0.10;
      if (saveSurprise) {
        setConsecutiveWins(1);
        setIsRushActive(true);
        setSpinState('rush_intro');
        sfx.playRushActivation();
        setTimeout(() => setSpinState('rush'), 3000);
      } else {
        setConsecutiveWins(0);
        setIsRushActive(false);
        setSpinState('idle');
      }
    }
  };

  // Spec shift changes machine
  const handleSpecChange = (specId: SpecType) => {
    setSelectedSpec(MACHINE_SPECS[specId]);
    // Reset spin states to normal
    setIsRushActive(false);
    setConsecutiveWins(0);
    setSpinState('idle');
    setHoryuuCount(0);
  };

  // Replenish Virtual Balls (Loans virtual cash)
  const handleReplenish = () => {
    setBallCount((prev) => prev + 250);
    setInvestedCash((prev) => prev + 1000);
    sfx.playHeso();
  };

  // Custom single manual shot
  const handleSingleShot = () => {
    if (ballCount <= 0) {
      handleReplenish();
      return;
    }
    // Spend 1 ball
    handleBallFired();
    // Invoke a momentary launch trigger event handled manually in canvas
    setIsShooting(true);
    setTimeout(() => {
      setIsShooting(false);
    }, 100);
  };

  // Handle auto-simulation shooter trigger feedback words
  const getGameStateWord = () => {
    if (spinState === 'jackpot') {
      return '★ 大当り降臨 !! アタッカーへ右打ち推奨 ★';
    }
    if (isRushActive) {
      return '★ RUSH突入中 ! 高確率1/30秒殺当りを掴め ★';
    }
    if (horyuuCount >= 4) {
      return '保留MAX ! 一時発射を止めて見入るのが良し';
    }
    if (ballCount <= 0) {
      return '持ち玉切れ！「玉貸し」ボタンを押してください。';
    }
    return '発射パワーを調整して、ヘソ(中心穴)を狙いましょう。';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-x-hidden pb-4">
      {/* Dynamic Ambient Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[550px] bg-gradient-to-b from-blue-900/10 via-purple-900/5 to-transparent pointer-events-none" />

      {/* Top Banner Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur px-4 py-3 relative z-40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Gamepad2 className="w-5.5 h-5.5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  e.onlineFever
                </h1>
                <span className="text-[9px] font-black uppercase text-yellow-400 bg-red-950/80 border border-red-700/60 px-1.5 py-0.2 rounded">
                  PREMIUM 擬似機
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">実機さながらのピン物理ボール・保留・液晶演出・激熱確率変動を完全再現</p>
            </div>
          </div>

          {/* Quick Real-Time Display parameters */}
          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>持ち玉: <strong className="text-amber-400 font-mono text-sm">{ballCount.toLocaleString()}</strong> 発</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-805 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Trophy className="w-4 h-4 text-pink-400" />
              <span>現在RUSH: <strong className="text-pink-400 font-mono text-sm">{consecutiveWins}</strong>連</span>
            </div>
            
            {/* Rulebook toggle (right-top details bar) */}
            <button
              onClick={() => setIsRulebookOpen(true)}
              id="open-rulebook-btn"
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-slate-950" />
              スペック・ルールブック
            </button>

            <button
              onClick={() => {
                if (confirm('ゲームデータをリセットして最初から（持ち玉1000発）やり直しますか？')) {
                  setBallCount(1000);
                  setInvestedCash(1000);
                  setTotalWon(0);
                  setTotalSpins(0);
                  setTotalJackpots(0);
                  setConsecutiveWins(0);
                  setHistoryList([]);
                  setIsRushActive(false);
                  setSpinState('idle');
                  setHoryuuCount(0);
                }
              }}
              id="game-reset-btn"
              className="text-xs border border-rose-900/50 hover:bg-rose-950/20 text-rose-400 px-3 py-1.5 rounded-lg font-bold transition-all"
            >
              データリセット
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="max-w-6xl mx-auto px-4 mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10 w-full flex-1 items-stretch">

        {/* LEFT COLUMN: PACHINKO GAME CABINET CABINET FRAME WITH INTEGRATED CONTROLS (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col items-center gap-3 justify-start">
          
          {/* Main Pachinko Machine Enclosure Shield (Unified Cabinet!) */}
          <div className="w-full max-w-[420px] bg-gradient-to-b from-slate-900 via-slate-900 to-black border-4 border-slate-800 rounded-3xl p-2.5 shadow-2lx flex flex-col items-center gap-3 relative overflow-hidden shadow-[0_0_35px_rgba(30,41,59,0.5)]">
            
            {/* Top cabinet neon belt */}
            <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-wider">CYBER AMUSEMENT S-77</span>
              </div>
              <div className="text-[10px] uppercase font-mono text-cyan-400 font-extrabold flex items-center gap-1">
                <span>MOCHIDAMA:</span>
                <span className="text-amber-400 font-mono font-black text-xs tracking-wider">{ballCount.toLocaleString()}発</span>
              </div>
            </div>

            {/* Cabinet core holding the Canvas board & LCD overlapping */}
            <div className="relative">
              {/* Real board rendering */}
              <Board
                shootingPower={shootingPower}
                isShooting={isShooting && ballCount > 0}
                onHesoGet={handleHesoGet}
                onAttackerScore={handleAttackerScore}
                onAwardBalls={handleAwardBalls}
                isAttackerOpen={isAttackerOpen}
                onBallFleshed={handleBallFired}
                currentBallCount={ballCount}
                autoTuningEnabled={autoTuningEnabled}
                ballsFiredCount={ballsFiredCount}
                totalSpins={totalSpins}
              />

              {/* Immersive overlay LCD screen */}
              <LcdScreen
                reels={reels}
                spinState={spinState}
                reachType={reachType}
                horyuuCount={horyuuCount}
                onTriggerButton={handleButtonPressAction}
                jackpotProgress={attackerScoreCount * 10} // 10 hits completes a round
                currentRound={currentRound}
                consecutiveJp={consecutiveWins}
                isRushActive={isRushActive}
              />
            </div>

            {/* INTEGRATED PACHINKO CONTROL PANEL DISH */}
            <div className="w-full bg-slate-950 border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-3 shadow-inner">
              
              {/* Mochidama ledger, loan system and volume toggle */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 bg-black/80 border border-slate-905 rounded-xl px-3 py-2 flex items-center justify-between shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-500 tracking-widest leading-none">持ち玉 (LED)</span>
                    <span className="text-[8px] text-slate-600 mt-1 leading-none">CYBER FEVER</span>
                  </div>
                  <span className={`text-2xl font-black font-mono tracking-tight ${ballCount > 50 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-rose-500 animate-pulse'}`}>
                    {ballCount.toLocaleString()} <span className="text-xs font-sans font-bold">発</span>
                  </span>
                </div>

                <div className="flex gap-1.5 shrink-0">
                  <button 
                    onClick={handleReplenish}
                    id="cabinet-loan-btn"
                    className="px-3.5 py-2.5 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg cursor-pointer active:scale-95 transition-all text-center flex flex-col items-center justify-center leading-tight hover:shadow-amber-500/10"
                  >
                    <span>玉貸し</span>
                    <span className="text-[8px] opacity-75 font-bold">¥1,000 / +250</span>
                  </button>

                  <button
                    onClick={handleMuteToggle}
                    id="cabinet-mute-btn"
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center ${
                      isMuted
                        ? 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900/20 shadow-inner'
                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-800'
                    }`}
                    title={isMuted ? '音声をオン' : '音声をミュート'}
                  >
                    {isMuted ? <span className="text-red-500 font-bold whitespace-nowrap">消音中</span> : <span className="text-slate-500 font-semibold whitespace-nowrap">音量ON</span>}
                  </button>
                </div>
              </div>

              {/* Shooting Dial & Manual/Auto Fire Controller inline */}
              <div className="grid grid-cols-12 gap-2.5 items-center bg-slate-900/30 p-2 border border-slate-900 rounded-xl">
                {/* Hand Power Range Slider */}
                <div className="col-span-6 flex flex-col gap-1 bg-slate-950/80 p-2 rounded-lg border border-slate-900 shadow-inner">
                  <div className="flex justify-between items-center text-[7px] text-slate-500 font-black leading-none uppercase">
                    <span>LAUNCH DIAL</span>
                    <span className="text-cyan-400 font-mono text-[9px] font-black">{shootingPower}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={shootingPower}
                    onChange={(e) => setShootingPower(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg cursor-pointer my-1"
                    style={{ background: 'linear-gradient(to right, #0891b2, #e11d48)' }}
                  />
                </div>

                {/* Automation trigger locks dial open */}
                <button
                  onClick={() => {
                    if (ballCount <= 0) {
                      handleReplenish();
                    } else {
                      setIsShooting(!isShooting);
                    }
                  }}
                  id="cabinet-auto-shoot-toggle"
                  className={`col-span-4 py-2.5 px-2 rounded-xl text-[11px] font-extrabold flex flex-col items-center justify-center leading-tight transition-all shadow-md cursor-pointer ${
                    isShooting
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white border border-slate-700'
                  }`}
                >
                  <span className="text-[8px] uppercase opacity-75 font-bold leading-none mb-0.5">{isShooting ? 'AUTO ACTIVE' : 'LOCKED ON'}</span>
                  <span className="font-sans leading-none">{isShooting ? 'おーと：稼働' : 'オート発射'}</span>
                </button>

                {/* Single manual click */}
                <button
                  onClick={handleSingleShot}
                  disabled={isShooting || ballCount <= 0}
                  className="col-span-2 py-2.5 rounded-xl text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-20 select-none active:scale-95 transition-all h-full text-center flex flex-col items-center justify-center leading-tight"
                >
                  <span className="text-[7.5px] uppercase opacity-50 font-bold leading-none mb-0.5">SINGLE</span>
                  <span>単発</span>
                </button>
              </div>

              {/* Status Ticker */}
              <p className="text-[8.5px] text-slate-400 text-center uppercase tracking-widest leading-none font-semibold font-mono pb-0.5">
                {getGameStateWord()}
              </p>
            </div>

            {/* Interactive Mechanical Cabinet Peripheral Tray */}
            <InteractivePeripheral
              spinState={spinState}
              reachType={reachType}
              onButtonPress={handleButtonPressAction}
              onLeverPull={handleLeverPullAction}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: RECONFIGURED COMPACT STATISTICS, SPECS, & HISTORY LOG (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          
          <ControlPanel
            currentPower={shootingPower}
            onPowerChange={setShootingPower}
            isShooting={isShooting}
            onShootingToggle={setIsShooting}
            ballCount={ballCount}
            totalSpins={totalSpins}
            totalJackpots={totalJackpots}
            consecutiveWins={consecutiveWins}
            investedCash={investedCash}
            totalWon={totalWon}
            onReplenishBalls={handleReplenish}
            onSingleShot={handleSingleShot}
            currentSpec={selectedSpec}
            onSpecChange={handleSpecChange}
            specs={MACHINE_SPECS}
            historyList={historyList}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            gameStateText={getGameStateWord()}
            onTriggerForcedReach={triggerForcedReachTest}
            autoTuningEnabled={autoTuningEnabled}
            onAutoTuningToggle={setAutoTuningEnabled}
            ballsFiredCount={ballsFiredCount}
          />

          {/* Quick UI assistance panel / tip block */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg text-xs text-slate-400">
            <h3 className="text-slate-300 font-bold mb-1 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              スクロール不要！一体型プレイエリア
            </h3>
            <p className="text-[10px] text-slate-500 leading-normal">
              「オート発射」「パワー調整」「持ち玉」「玉貸し」を含むすべての主要プレイ操作をパチンコ筐体に直接統合しました！
              右側に集約された確率スペック切り替えと大当り分析データを眺めながら、極限のRUSH連チャンをお楽しみください。
            </p>
          </div>

        </section>
      </main>

      {/* Slide-out Sidebar Rulebook component */}
      <AnimatePresence>
        {isRulebookOpen && (
          <>
            {/* Dark overlay backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRulebookOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 pointer-events-auto"
            />
            {/* Sliding cabinet rulebook drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 190 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-55 flex flex-col text-slate-100"
            >
              {/* Rulebook Header bar */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <div>
                    <h2 className="text-sm font-black tracking-wider text-slate-100">スペック・遊技ガイド</h2>
                    <p className="text-[10px] text-slate-400">CYBER PARLOR プレミアム虎の巻</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRulebookOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  閉じる
                </button>
              </div>

              {/* Rulebook drawer Scrollable container */}
              <div className="p-5 flex-1 overflow-y-auto space-y-6">
                
                {/* 1. Play Specs comparison listing cards */}
                <div>
                  <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-1.5">
                    ⚙️ 機種スペック詳細比較
                  </h3>
                  <div className="space-y-3">
                    {Object.values(MACHINE_SPECS).map((spec) => (
                      <div key={spec.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5 mb-1.5">
                          <strong className="text-slate-100 font-bold">{spec.name}</strong>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            spec.id === 'MAX' ? 'bg-rose-950 text-rose-400 border border-rose-900/40' :
                            spec.id === 'MIDDLE' ? 'bg-cyan-950 text-cyan-400 border border-cyan-900/40' :
                            'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                          }`}>
                            {spec.id} SPEC
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 leading-normal mb-1.5 font-sans">
                          <div>
                            <span className="text-slate-500">通常大当り確率:</span> <strong className="text-slate-200">1/{spec.jpProbability}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">RUSH中確率:</span> <strong className="text-pink-400 font-mono">1/{spec.rushJpProbability}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">確変突入率:</span> <strong className="text-yellow-400">{spec.rushRate * 100}%</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">FEVER継続率:</span> <strong className="text-emerald-400 font-black">{Math.round((1 - spec.rushEscapeRate) * 100)}%</strong>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed bg-slate-900/40 p-2 rounded-lg border border-slate-900/30">
                          {spec.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Interactive user guide steps */}
                <div>
                  <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-1.5">
                    📖 遊技の手順 ＆ 虎の巻
                  </h3>
                  
                  {/* Inner Guide Tab Selector */}
                  <div className="flex border-b border-slate-800 mb-4 gap-1">
                    <button
                      onClick={() => setActiveTab('basic')}
                      className={`flex-1 py-1 text-center text-[10px] font-black tracking-wider transition-all rounded ${
                        activeTab === 'basic' ? 'bg-slate-800 text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      基本フロー
                    </button>
                    <button
                      onClick={() => setActiveTab('glossary')}
                      className={`flex-1 py-1 text-center text-[10px] font-black tracking-wider transition-all rounded ${
                        activeTab === 'glossary' ? 'bg-slate-850 text-pink-400 font-bold' : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      用語ガイド
                    </button>
                  </div>

                  <div className="text-[11px] leading-relaxed text-slate-300 space-y-4">
                    {activeTab === 'basic' ? (
                      <>
                        <div className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.2)]">1</span>
                          <p>
                            <strong>【玉を買う（貸出し）】</strong><br />
                            Mochidama（持ち玉）がなくなったら、コンソールまたは盤面下の<strong>「玉貸し」</strong>ボタンをクリックしてチャージ（¥1,000単位、250発）。
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.2)]">2</span>
                          <p>
                            <strong>【ハンドルを調整 ＆ オート発射】</strong><br />
                            発射パワーハンドル（推奨: 60%〜75%）を調整し、<strong>「オート発射」</strong>ボタンをクリックしてボールを放ちます（自動で連射されます）。
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.2)]">3</span>
                          <p>
                            <strong>【ハズを抜けてヘソを狙う】</strong><br />
                            物理コライダーによってピンの海を落下したボールが、中央の<strong>ヘソ（始動ポケット）</strong>に入ると液晶スロットが変動します。保留は最大4つまでストック！
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.2)]">4</span>
                          <p>
                            <strong>【リーチ＆チャンスのギミック連動】</strong><br />
                            同じ絵柄が揃うと激熱のリーチ変動へ！一撃カットインや激熱演出時にはマシーン下の<strong>「PUSHボタン」</strong>や<strong>「レバー」</strong>を引いて、演出の行く末を決定しましょう！
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center text-xs font-bold shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.2)]">5</span>
                          <p>
                            <strong>【大当り＆アタッカーに右打ち】</strong><br />
                            絵柄が「3つ」揃えば大当り降臨！盤面最下部の<strong>右下アタッカー（FEVER）</strong>が解放されるので、発射パワー上限（約75%〜100%の右打ち）にしてボールを叩き込み、大量の賞球を獲得しましょう！
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 text-slate-400">
                          <strong className="text-cyan-400 font-bold block mb-1">● ヘソ（始動口）:</strong>
                          通常時の核心ポケット。ここに入賞すると中央の液晶画面でリール変動（抽選）が行われ、保留に格納されます。
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 text-slate-400">
                          <strong className="text-pink-400 font-bold block mb-1">● アタッカー（大入賞口）:</strong>
                          大当り中（Fever）のみ解放される最大のポケット。ここにballをねじ込むことで、もっとも高い賞球（1球につき15発）が得られます。
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 text-slate-400">
                          <strong className="text-yellow-400 font-bold block mb-1">● 確率変動・高確率ラッシュ:</strong>
                          確変機最大の魅力で、奇数大当りで突入。スロットの当選確率が大幅（ミドルでは1/199 → 1/35）に上昇し、スピーディー大当りがループします！
                        </div>
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/60 text-slate-400">
                          <strong className="text-emerald-400 font-bold block mb-1">● セーフ（一般入賞口）:</strong>
                          盤面左右の中央にある、払い出しのあるポケット。入ると5発のballが払い出され、持ちをサポートします。
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-slate-800">
                  © 2026 CYBER REELパーラー. Web Audio & PhysX Engine.
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Decorative footer credits */}
      <footer className="mt-6 border-t border-slate-900 pt-4 text-center text-xs text-slate-500 font-medium pb-4">
        <p>© 2026 CYBER REELパーラー. All rights reserved. 擬似パチンコ遊技シミュレーター（お遊び用・換金不可）</p>
      </footer>
    </div>
  );
}
