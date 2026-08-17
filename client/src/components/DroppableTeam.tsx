import { useDroppable } from '@dnd-kit/core';
import { DraggablePlayer } from './DraggablePlayer';

export const DroppableTeam = ({ t, validMembers, handleDelete }: any) => {
  const { isOver, setNodeRef } = useDroppable({
    id: t.id,
  });

  return (
    <div id={`team-card-${t.id}`} className="card bg-base-100 shadow-2xl border-t-8 border-t-primary w-[350px] shrink-0 self-start h-[500px] flex flex-col hover:shadow-[0_0_20px_rgba(var(--primary),0.2)] transition-shadow">
      <div className="p-5 border-b border-base-200 flex justify-between items-center bg-base-100 shrink-0">
        <h3 className="font-bold text-xl">Team {t.team_number}</h3>
        <span className="badge badge-primary badge-outline font-bold">{validMembers.length} / 11</span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`p-4 flex-1 overflow-y-auto space-y-3 transition-colors ${isOver ? 'bg-primary/10 border-primary/20 shadow-inner' : 'bg-base-100'}`}
      >
        {validMembers.map((m: any) => (
          <DraggablePlayer key={m.id} m={m} handleDelete={handleDelete} />
        ))}
        {validMembers.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed border-base-300 rounded-xl text-base-content/40 text-sm font-medium mt-4 pointer-events-none">
            Drag players here
          </div>
        )}
      </div>
    </div>
  );
};
