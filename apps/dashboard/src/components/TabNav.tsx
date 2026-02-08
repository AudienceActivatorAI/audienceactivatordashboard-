const tabs = ['Overview', 'Geo Intelligence', 'Vehicle Demand', 'Intent & Segments', 'Codex'] as const;

export type TabKey = (typeof tabs)[number];

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export const TabNav = ({ activeTab, onChange }: Props) => {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
            activeTab === tab
              ? 'bg-white text-ink-900'
              : 'bg-white/10 border border-white/15 text-white/70 hover:text-white'
          }`}
          type="button"
        >
          {tab}
        </button>
      ))}
    </div>
  );
};
