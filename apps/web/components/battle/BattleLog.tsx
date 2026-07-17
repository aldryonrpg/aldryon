import { useEffect, useRef } from "react";

interface BattleLogProps {
  /** The full accumulated log for this page visit — every turn appends,
   * never replaces, so the player can scroll back through earlier ones. */
  lines: string[];
}

export function BattleLog({ lines }: BattleLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs only to scroll when a new line is appended, not because the value is read
  useEffect(() => {
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={containerRef}
      className="max-h-40 min-h-32 overflow-y-auto border border-white bg-black p-3 text-sm"
    >
      {lines.length === 0 ? (
        <p className="text-stone-400">The battle begins...</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the log only ever grows by appending, never reorders
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
