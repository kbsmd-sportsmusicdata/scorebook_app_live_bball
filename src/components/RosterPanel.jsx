// Full roster for the selected team, with tap-to-toggle starter selection (5 max).
export default function RosterPanel({ team, starterIds, onToggleStarter, starterLimit }) {
  const full = starterIds.length >= starterLimit;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Roster</h3>
        <span
          className={`text-sm font-semibold ${full ? '' : 'text-slate-500'}`}
          style={full ? { color: team.color } : undefined}
        >
          Starters {starterIds.length}/{starterLimit}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {team.players.map((player) => {
          const isStarter = starterIds.includes(player.playerId);
          const blocked = !isStarter && full;
          return (
            <li key={player.playerId}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => onToggleStarter(player.playerId)}
                className={`flex w-full items-center gap-3 rounded-lg border-2 bg-white px-3 py-2 text-left transition
                  ${isStarter ? 'shadow-sm' : 'border-slate-200 hover:border-slate-400'}
                  ${blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                style={isStarter ? { borderColor: team.color, backgroundColor: `${team.color}14` } : undefined}
                aria-pressed={isStarter}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: team.color }}
                >
                  {player.jersey ?? '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {player.name}
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{player.position}</span>
                {isStarter && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundColor: team.color }}
                  >
                    Starter
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
