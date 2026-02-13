export function TeamSection({ teamReport, userName }: any) {
  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl p-6 shadow-lg">
      <h2 className="text-lg font-bold text-center mb-6">Team Structure</h2>

      <div className="flex flex-col items-center space-y-4">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl shadow">
          <p className="font-bold">{userName}</p>
          <p className="text-xs opacity-80 text-center">(YOU)</p>
        </div>

        <Arrow />

        <TeamBox
          title="TEAM A"
          count={teamReport.levels.A.count}
          commission="18%"
          gradient="from-green-400 to-emerald-500"
        />

        <Arrow />

        <TeamBox
          title="TEAM B"
          count={teamReport.levels.B.count}
          commission="3%"
          gradient="from-teal-400 to-cyan-500"
        />

        <Arrow />

        <TeamBox
          title="TEAM C"
          count={teamReport.levels.C.count}
          commission="2%"
          gradient="from-blue-400 to-indigo-500"
        />
      </div>
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-400 text-xl">↓</div>;
}

function TeamBox({ title, count, commission, gradient }: any) {
  return (
    <div
      className={`w-full text-white rounded-xl px-6 py-4 text-center shadow bg-gradient-to-r ${gradient}`}
    >
      <p className="text-2xl font-bold">{count}</p>
      <p className="font-semibold">{title}</p>
      <p className="text-xs opacity-80">{commission} Commission</p>
    </div>
  );
}
