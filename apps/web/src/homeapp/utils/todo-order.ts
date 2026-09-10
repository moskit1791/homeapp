type OrderedTodo = { id: string; status: string };

export function todoMovePlan(items: OrderedTodo[], draggedId: string, targetId: string) {
  const pending = items.filter((item) => item.status !== 'done');
  const from = pending.findIndex((item) => item.id === draggedId);
  const to = pending.findIndex((item) => item.id === targetId);

  if (from < 0 || to < 0 || from === to) return null;
  return { direction: from < to ? ('down' as const) : ('up' as const), steps: Math.abs(to - from) };
}

export function reorderTodosAfterDrop<T extends OrderedTodo>(
  items: T[],
  draggedId: string,
  targetId: string
): T[] {
  const pending = items.filter((item) => item.status !== 'done');
  const done = items.filter((item) => item.status === 'done');
  const from = pending.findIndex((item) => item.id === draggedId);
  const to = pending.findIndex((item) => item.id === targetId);

  if (from < 0 || to < 0 || from === to) return items;
  const reordered = [...pending];
  const [dragged] = reordered.splice(from, 1);
  reordered.splice(to, 0, dragged);
  return [...reordered, ...done];
}
