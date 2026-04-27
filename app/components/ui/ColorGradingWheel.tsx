"use client";

interface ColorGradingWheelProps {
  hue: number;
  saturation: number;
  label: string;
}

export function ColorGradingWheel({ hue, saturation, label }: ColorGradingWheelProps) {
  const angle = (hue / 360) * Math.PI * 2 - Math.PI / 2;
  const r = (saturation / 100) * 28;
  const x = 36 + r * Math.cos(angle);
  const y = 36 + r * Math.sin(angle);
  const hasDot = saturation > 0 && hue !== 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="32" fill="none" stroke="var(--border)" strokeWidth="1" />
        <circle cx="36" cy="36" r="16" fill="none" stroke="var(--bg)" strokeWidth="1" />
        {[0, 60, 120, 180, 240, 300].map((h) => {
          const a = (h / 360) * Math.PI * 2 - Math.PI / 2;
          return (
            <line key={h} x1="36" y1="36"
              x2={36 + 32 * Math.cos(a)} y2={36 + 32 * Math.sin(a)}
              stroke="var(--border-2)" strokeWidth="1"
            />
          );
        })}
        {hasDot ? (
          <circle cx={x} cy={y} r="4.5" fill={`hsl(${hue},65%,55%)`} stroke="white" strokeWidth="1.5" />
        ) : (
          <circle cx="36" cy="36" r="3.5" fill="var(--border)" stroke="white" strokeWidth="1.5" />
        )}
      </svg>
      <span className="text-[10px] uppercase tracking-[0.1em]" style={{color:"var(--text-4)"}}>{label}</span>
      {hasDot && (
        <span className="text-[10px] font-mono" style={{ color: `hsl(${hue},65%,45%)` }}>
          {hue}° / {saturation}%
        </span>
      )}
    </div>
  );
}
