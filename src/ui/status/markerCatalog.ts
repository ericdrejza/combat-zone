import {
  Crosshair, Handshake, Droplet, Sparkle, EyeOff, BicepsFlexed, Flame, Magnet, Brain,
  Shell, BrickWallShield, BadgeX, EarOff, HatGlasses, WandSparkles, Zap, BatteryLow, Feather,
  Ghost, HandGrab, ShieldCheck, SportShoe, EyeDashed, Anchor, Ban, Lightbulb, EyeClosed,
  LocateFixed, MouthOff, LockKeyhole, Stone, Biohazard, ZapOff, ArrowDownToLine, ShieldHalf,
  Link, Thermometer, Snail, Galaxy, HandFist, Sword, Swords, Axe, BowArrow,
  ShieldOff, ShieldMinus, Shield, ShieldPlus, type LucideIcon
} from "lucide-react";

export type StatusMarker = { id: string; label: string; Icon: LucideIcon };
const conditions: [string, LucideIcon][] = [
  ["Aiming", Crosshair], ["Assisted / Helped", Handshake], ["Bleeding", Droplet],
  ["Blessed", Sparkle], ["Blinded", EyeOff], ["Bolstered", BicepsFlexed], ["Burning", Flame],
  ["Charmed", Magnet], ["Concentrating", Brain], ["Confused", Shell], ["Cover", BrickWallShield],
  ["Cursed", BadgeX], ["Deafened", EarOff], ["Disguised", HatGlasses], ["Enchanted", WandSparkles],
  ["Energized", Zap], ["Exhausted / Fatigued", BatteryLow], ["Flying", Feather], ["Frightened", Ghost],
  ["Grappled / Grabbed", HandGrab], ["Guarded / Shielded", ShieldCheck], ["Hasted / Quickened", SportShoe],
  ["Hidden / Concealed", EyeDashed], ["Immobilized", Anchor], ["Incapacitated", Ban], ["Inspired", Lightbulb],
  ["Invisible", EyeClosed], ["Marked", LocateFixed], ["Muted / Silenced", MouthOff], ["Paralyzed", LockKeyhole],
  ["Petrified", Stone], ["Poisoned", Biohazard], ["Powerless", ZapOff], ["Prone", ArrowDownToLine],
  ["Resistant", ShieldHalf], ["Restrained", Link], ["Sickened", Thermometer], ["Slowed", Snail], ["Stunned", Galaxy]
];
export const CONDITIONS: StatusMarker[] = conditions.map(([label, Icon]) => ({
  id: label.split(" / ")[0].toLowerCase().replace(/ /g, "-"), label, Icon
})).sort((a, b) => a.label.localeCompare(b.label));
/** Presentation-only groups; actor status remains the existing marker IDs. */
const buffIds = new Set([
  "aiming", "assisted", "blessed", "bolstered", "cover", "disguised", "enchanted",
  "energized", "flying", "guarded", "hasted", "hidden", "inspired", "invisible", "resistant"
]);
export const CONDITION_GROUPS = [
  { title: "Buffs", markers: CONDITIONS.filter(({ id }) => buffIds.has(id)) },
  { title: "Debuffs", markers: CONDITIONS.filter(({ id }) => !buffIds.has(id)) }
];
export const WEAPONS: StatusMarker[] = [
  { id: "weapon:fist", label: "Fist", Icon: HandFist },
  { id: "weapon:sword", label: "Sword", Icon: Sword },
  { id: "weapon:swords", label: "Swords", Icon: Swords },
  { id: "weapon:axe", label: "Axe", Icon: Axe },
  { id: "weapon:bow", label: "Bow", Icon: BowArrow }
];
export const ARMOR: StatusMarker[] = [
  { id: "armor:no-armor", label: "No armor", Icon: ShieldOff },
  { id: "armor:light", label: "Light armor", Icon: ShieldMinus },
  { id: "armor:medium", label: "Medium armor", Icon: Shield },
  { id: "armor:heavy", label: "Heavy armor", Icon: ShieldPlus }
];
