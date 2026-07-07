// 8-team picker grid: each button shows the team logo, name, and color accent.
export default function TeamPicker({ teams, selectedTeamId, disabledTeamId, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {teams.map((team) => {
        const selected = team.teamId === selectedTeamId;
        const disabled = team.teamId === disabledTeamId;
        return (
          <button
            key={team.teamId}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(team.teamId)}
            className={`flex items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition
              ${selected ? 'shadow-md' : 'border-slate-200 hover:border-slate-400'}
              ${disabled ? 'opacity-35 cursor-not-allowed' : 'cursor-pointer'}`}
            style={selected ? { borderColor: team.color } : undefined}
            aria-pressed={selected}
          >
            <img
              src={team.logo}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full bg-slate-100 object-contain"
              loading="lazy"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">{team.name}</span>
              <span
                className="mt-1 block h-1.5 w-12 rounded-full"
                style={{ backgroundColor: team.color }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
