type Props = {
  identified: number;
  highIntent: number;
  avgIntent: number;
  opportunity: number;
  contactable: number;
  audienceSize: number;
};

const formatNumber = (value: number) => value.toLocaleString();

export const KpiCards = ({ identified, highIntent, avgIntent, opportunity, contactable, audienceSize }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">Identified Shoppers</span>
        <div className="text-2xl font-semibold">{formatNumber(identified)}</div>
        <span className="text-xs text-white/60">Weighted demo count</span>
      </div>
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">Contactable Audience</span>
        <div className="text-2xl font-semibold">{formatNumber(contactable)}</div>
        <span className="text-xs text-white/60">Email or phone</span>
      </div>
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">Ad Audience Size</span>
        <div className="text-2xl font-semibold">{formatNumber(audienceSize)}</div>
        <span className="text-xs text-white/60">Meta / Google / TikTok</span>
      </div>
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">High Intent</span>
        <div className="text-2xl font-semibold">{formatNumber(highIntent)}</div>
        <span className="text-xs text-white/60">Hot + SuperHot</span>
      </div>
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">Avg Intent Score</span>
        <div className="text-2xl font-semibold">{avgIntent}</div>
        <span className="text-xs text-white/60">0 - 100</span>
      </div>
      <div className="kpi-card">
        <span className="text-xs uppercase tracking-widest text-white/50">Opportunity Index</span>
        <div className="text-2xl font-semibold">{opportunity}</div>
        <span className="text-xs text-white/60">Composite signal</span>
      </div>
    </div>
  );
};
