interface ActionButtonsProps {
  openPanel: "attacks" | "bag" | null;
  disabled: boolean;
  onAttackClick: () => void;
  onBagClick: () => void;
  onRest: () => void;
  onRun: () => void;
}

function actionClass(active: boolean) {
  return `battle-button w-28 rounded-md px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50 ${
    active ? "ring-2 ring-white" : ""
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
      <button
        type="button"
        onClick={onAttackClick}
        disabled={disabled}
        className={actionClass(openPanel === "attacks")}
      >
        Attack
      </button>
      <button
        type="button"
        onClick={onBagClick}
        disabled={disabled}
        className={actionClass(openPanel === "bag")}
      >
        Bag
      </button>
      <button type="button" onClick={onRest} disabled={disabled} className={actionClass(false)}>
        Rest
      </button>
      <button type="button" onClick={onRun} disabled={disabled} className={actionClass(false)}>
        Run
      </button>
    </div>
  );
}
