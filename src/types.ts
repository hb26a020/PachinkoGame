/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SpecType = 'SWEET' | 'MIDDLE' | 'MAX';
export type ReachType = 'none' | 'normal' | 'fire' | 'thunder' | 'button_chance' | 'button_chance_hit' | 'lever_chance_hit';

export interface MachineSpec {
  id: SpecType;
  name: string;
  jpProbability: number; // e.g. 1 / 319
  rushJpProbability: number; // Chance during rush e.g. 1 / 35
  rushRate: number; // Chance that a JP triggers Kakuhen Rush, e.g. 0.5 (50%) or 0.6 (60%)
  rushEscapeRate: number; // Chance of escaping Rush upon normal JP (or standard end), e.g. 0.15 (85% continuity)
  payoutNormal: number; // Balls awarded for normal JP
  payoutFever: number; // Balls awarded for Fever JP (during Rush)
  description: string;
}

export interface PachinkoBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  bounces: number;
  isDead: boolean;
  color: string;
  inLaunchTube?: boolean;
  inWarp?: boolean;
  warpT?: number;
  onStage?: boolean;
  stageX?: number;
  stageVx?: number;
  hesoSlowed?: boolean;
}

export interface Pin {
  x: number;
  y: number;
  radius: number;
  type: 'normal' | 'bumper' | 'heso-guide';
}

export interface Pocket {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'heso' | 'attacker' | 'side' | 'out';
  label: string;
  payout: number;
}

export interface JackpotHistory {
  spinCount: number;
  type: 'NORMAL' | 'FEVER' | 'RUSH_STARTER';
  payout: number;
  time: string;
  consecutiveCount: number;
}
