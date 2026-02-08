import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TrendPoint = {
  date: string;
  identified_shoppers: number;
  high_intent_shoppers: number;
  avg_intent_score: number;
  opportunity_index: number;
};

type Props = {
  data: TrendPoint[];
};

export const TrendChart = ({ data }: Props) => {
  return (
    <div className="glass-panel p-6 h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg">Intent Momentum</h3>
        <span className="chip">Daily rollup</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="intentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3AE6B6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3AE6B6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="#AEB6C6" fontSize={12} />
          <YAxis stroke="#AEB6C6" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: '#0E111A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
            }}
          />
          <Area
            type="monotone"
            dataKey="high_intent_shoppers"
            stroke="#3AE6B6"
            fill="url(#intentGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
