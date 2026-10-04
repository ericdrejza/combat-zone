import { BoneFracture, HeartCrack, HeartPulse, Skull } from "lucide-react";

export const HEALTH_STATUSES = [
  { value: 0, label: "Dead", Icon: Skull },
  { value: 1, label: "Unconscious / severely injured", Icon: BoneFracture },
  { value: 2, label: "Injured", Icon: HeartCrack },
  { value: 3, label: "Healthy", Icon: HeartPulse }
] as const;
