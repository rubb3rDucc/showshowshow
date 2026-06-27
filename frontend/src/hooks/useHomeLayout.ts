import { useEffect, useState } from 'react';

const STORAGE_KEY = 'home.layout.v1';

interface StoredLayout {
  order: string[];
  hidden: string[];
}

function loadStored(): StoredLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredLayout) : null;
  } catch {
    return null;
  }
}

/**
 * Persisted Home dashboard layout (widget order + hidden set), stored per-device in
 * localStorage. Reconciles stored ids with the current widget registry so adding/removing
 * a widget later doesn't break a saved layout.
 */
export function useHomeLayout(allIds: string[]) {
  const [state, setState] = useState<StoredLayout>(() => {
    const stored = loadStored();
    const storedOrder = stored?.order ?? [];
    const order = [
      ...storedOrder.filter((id) => allIds.includes(id)),
      ...allIds.filter((id) => !storedOrder.includes(id)),
    ];
    const hidden = (stored?.hidden ?? []).filter((id) => allIds.includes(id));
    return { order, hidden };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [state]);

  const move = (id: string, dir: -1 | 1) =>
    setState((s) => {
      const i = s.order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.order.length) return s;
      const order = [...s.order];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...s, order };
    });

  const toggleHidden = (id: string) =>
    setState((s) => ({
      ...s,
      hidden: s.hidden.includes(id) ? s.hidden.filter((x) => x !== id) : [...s.hidden, id],
    }));

  return {
    order: state.order,
    isHidden: (id: string) => state.hidden.includes(id),
    moveUp: (id: string) => move(id, -1),
    moveDown: (id: string) => move(id, 1),
    toggleHidden,
  };
}
