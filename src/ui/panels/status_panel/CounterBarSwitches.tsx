import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { mapCounterBar, type ResourceBars } from "@entities/actor/resourceBars";
import { PreferenceSwitch } from "@ui/settings/PreferenceSwitch";

export type CounterBarMapping = { value: ResourceBars; counterNames: Record<string, string>; onChange: (mapping: ResourceBars) => void };

/** One counter can own one slot; assigning it moves ownership from the other slot. */
export function CounterBarSwitches({ counterId, maximum, mapping }: {
  counterId: string; maximum: string; mapping: CounterBarMapping;
}) {
  const { healthCounterName } = useInterfacePreferences();
  const enabled = maximum.trim() !== "" && Number.isSafeInteger(Number(maximum)) && Number(maximum) > 0;
  return <fieldset className="space-y-2 border-t border-canvas-line pt-3">
    <legend className="text-sm font-semibold">Token resource bars</legend>
    {(["first", "second"] as const).map((slot, index) => {
      const source = mapping.value[slot];
      const replaces = source?.kind === "health" ? healthCounterName :
        source?.kind === "counter" && source.counterId !== counterId ? mapping.counterNames[source.counterId] : undefined;
      const description = [!enabled ? "Set a positive maximum to map this counter." : undefined,
        replaces ? `Replaces ${replaces}` : undefined].filter(Boolean).join(" ") || undefined;
      return <PreferenceSwitch compact key={slot} label={`Resource ${index + 1}`} disabled={!enabled}
        checked={enabled && source?.kind === "counter" && source.counterId === counterId}
        description={description}
        onChange={(checked) => mapping.onChange(mapCounterBar(mapping.value, counterId, slot, checked))} />;
    })}
  </fieldset>;
}
