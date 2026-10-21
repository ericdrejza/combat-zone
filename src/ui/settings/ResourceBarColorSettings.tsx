import { resourceBarFill, type ResourceBarGradient } from "@ui/interface_preferences/resourceBarColors";
import { HexColorInput } from "./HexColorInput";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsSubsection } from "./SettingsLayout";

type Props = {
  label: string;
  color: string;
  defaultColor: string;
  gradient: ResourceBarGradient;
  onColorChange: (color: string) => void;
  onGradientChange: (gradient: ResourceBarGradient) => void;
};

/** Static and amount-based colors retain their settings independently when switching modes. */
export function ResourceBarColorSettings({ label, color, defaultColor, gradient, onColorChange, onGradientChange }: Props) {
  return <SettingsSubsection title={label}>
    <PreferenceSwitch label={`Use gradient for ${label}`} checked={gradient.enabled}
      onChange={enabled => onGradientChange({ ...gradient, enabled })} />
    {gradient.enabled ? <>
      <p className="text-xs text-canvas-muted">Choose the colors at empty and full. The entire fill uses one blended color based on the current amount.</p>
      <HexColorInput label={`${label} low fill color`} value={gradient.low} placeholder={defaultColor}
        description="Color at 0%." onCommit={low => onGradientChange({ ...gradient, low: low ?? defaultColor })} />
      <HexColorInput label={`${label} high fill color`} value={gradient.high} placeholder={defaultColor}
        description="Color at 100%." onCommit={high => onGradientChange({ ...gradient, high: high ?? defaultColor })} />
      <div role="group" aria-label={`${label} color preview`} className="grid grid-cols-5 gap-2 py-2">
        {[0, 0.25, 0.5, 0.75, 1].map(fraction => <div key={fraction} className="space-y-1 text-center text-xs text-canvas-muted">
          <div className="h-3 rounded border border-canvas-line" style={{ backgroundColor: resourceBarFill(color, gradient, fraction) }} />
          <span>{fraction * 100}%</span>
        </div>)}
      </div>
    </> : <HexColorInput label={`${label} fill color`} value={color} placeholder={defaultColor}
      onCommit={next => onColorChange(next ?? defaultColor)} />}
  </SettingsSubsection>;
}
