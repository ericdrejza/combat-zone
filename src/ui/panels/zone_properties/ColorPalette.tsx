import { ColorPalettePicker } from "@ui/controls/ColorPalettePicker";
import type { CommitZoneProperties } from "./types";
import { useEffect, useId } from 'react';
import { useColorSampler } from '@ui/canvas/color_sampler/ColorSamplerProvider';
import { SamplerButton } from '@ui/canvas/color_sampler/SamplerButton';

type ZoneColorProperty = "colorFill" | "colorBorder" | "colorEngagement";
export function ColorPalette({ disabled, label, onCommitZoneProperties, property, value }: {
  disabled?: boolean; label: string; onCommitZoneProperties: CommitZoneProperties;
  property: ZoneColorProperty; value: string;
}) {
  const sampler = useColorSampler(), id = useId();
  const key = `${id}:${property}`;
  useEffect(() => () => sampler.cancel(key), [key, sampler.cancel]);
  useEffect(() => { if (disabled) sampler.cancel(key); }, [disabled, key, sampler.cancel]);
  return <ColorPalettePicker disabled={disabled} label={label} value={value}
    labelAction={<><SamplerButton label="Background color matcher" active={sampler.session?.key === key} disabled={disabled}
      onClick={() => sampler.toggle({ key, kind: 'background', pick: color => {
        if (color.toLowerCase() !== value.toLowerCase()) onCommitZoneProperties({ [property]: color });
      } })} />
      {sampler.error ? <span role="alert" className="text-xs text-canvas-muted">{sampler.error}</span> : null}</>}
    onChange={color => onCommitZoneProperties({ [property]: color })} />;
}
