interface ActionButtonsProps {
  openPanel: "attacks" | "bag" | null;
  disabled: boolean;
  onAttackClick: () => void;
  onBagClick: () => void;
  onRest: () => void;
  onRun: () => void;
}

function actionClass(active: boolean) {
  return `w-28 border border-white bg-black px-4 py-3 hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 ${
    active ? "bg-stone-800" : ""
  }`;
}

export function ActionButtons({
  openPanel,
  disabled,
  onAttackClick,
  onBagClick,
  onRest,
  onRun,
}: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onAttackClick}
          disabled={disabled}
          className={actionClass(openPanel === "attacks")}
        >
          Attack
        </button>
        <span className="border border-white bg-black px-2 text-[10px] text-stone-400">Opens</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onBagClick}
          disabled={disabled}
          className={actionClass(openPanel === "bag")}
        >
          Bag
        </button>
        <span className="border border-white bg-black px-2 text-[10px] text-stone-400">Opens</span>
      </div>
      <button type="button" onClick={onRest} disabled={disabled} className={actionClass(false)}>
        Rest
      </button>
      <button type="button" onClick={onRun} disabled={disabled} className={actionClass(false)}>
        Run
      </button>
    </div>
  );
}
