import { useDraggable } from '@dnd-kit/core';

export const DraggablePlayer = ({ m, handleDelete }: any) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: m.id,
    data: { player: m }
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-xl border flex justify-between items-center gap-2 transition-all ${isDragging ? 'opacity-50' : 'bg-base-200 border-base-300 hover:border-primary/40'} relative z-10 cursor-grab`}
      style={style}
    >
      <div className="flex items-center gap-3 pointer-events-none">
        <div className={`w-3 h-3 rounded-full shadow-sm ${m.tier === 'ADVANCED' ? 'bg-secondary' : m.tier === 'MID' ? 'bg-accent' : 'bg-primary'}`}></div>
        <div>
          <p className="font-bold text-sm truncate max-w-[140px]">{m.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-primary pointer-events-none">{m.rating}</span>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(m.id); }} onPointerDown={(e) => e.stopPropagation()} className="btn btn-xs btn-square btn-ghost text-error hover:bg-error/20 z-50 relative pointer-events-auto" title="Delete Player">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
};
