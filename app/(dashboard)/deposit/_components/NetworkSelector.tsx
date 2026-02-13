export function NetworkSelector({ networks, selected, onSelect }: any) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h4 className="font-semibold mb-3 text-sm">Select Network</h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {networks.map((n: any) => (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            className={`px-4 py-3 rounded-lg text-sm font-medium transition
              ${
                selected === n.id
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
          >
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}
