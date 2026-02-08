import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Props = {
  warm: number;
  hot: number;
  superhot: number;
};

export const IntentSegments = ({ warm, hot, superhot }: Props) => {
  const data = [
    { name: 'Warm', value: warm },
    { name: 'Hot', value: hot },
    { name: 'SuperHot', value: superhot },
  ];

  return (
    <div className="glass-panel p-6 h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">Intent Tiers</h3>
        <span className="chip">Warm / Hot / SuperHot</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#AEB6C6" fontSize={12} />
          <YAxis stroke="#AEB6C6" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: '#0E111A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            }}
          />
          <Bar dataKey="value" fill="#FF8A3D" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
