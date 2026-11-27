import { useEffect, useState } from "react";

export function TafeCoinBadge() {
  return (
    <span className="tafecoin-mark" aria-hidden="true">
      T
    </span>
  );
}

export function TafeCoinReward({
  amount,
  label,
}: {
  amount: number;
  label: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 4600);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <aside className="tafecoin-reward" role="status">
      <TafeCoinBadge />
      <div>
        <strong>+{amount} TafeCoin</strong>
        <span>{label}</span>
      </div>
    </aside>
  );
}
