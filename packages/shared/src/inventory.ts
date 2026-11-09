export const MOVEMENT_TYPES = ["reserve", "release", "consume", "adjust"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export function availableQty(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}
