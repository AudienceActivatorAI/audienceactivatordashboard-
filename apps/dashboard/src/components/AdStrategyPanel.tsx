type Props = {
  creditRating?: string;
  intentTier?: string;
};

const getCreditLabel = (creditRating?: string) => {
  if (!creditRating) return 'All Credit';
  if (['A', 'B'].includes(creditRating)) return 'Prime';
  if (creditRating === 'C') return 'Near Prime';
  return 'Subprime';
};

const getIntentLabel = (intentTier?: string) => {
  if (!intentTier) return 'All Intent';
  return intentTier;
};

const rules = [
  {
    id: 'prime-hot',
    credit: ['A', 'B'],
    intent: ['Hot', 'SuperHot'],
    headline: 'Premium & Trade-In Upgrade Push',
    bullets: [
      'Premium trim + warranty bundles',
      'Trade-in upgrade incentives',
      'Payment calculator + pre-approval CTA',
    ],
  },
  {
    id: 'prime-warm',
    credit: ['A', 'B'],
    intent: ['Warm'],
    headline: 'Inventory + Comparison Ads',
    bullets: [
      'Model comparison and feature highlights',
      'New arrivals & limited inventory urgency',
      'VDP retargeting with MSRP anchors',
    ],
  },
  {
    id: 'nearprime-hot',
    credit: ['C'],
    intent: ['Hot', 'SuperHot'],
    headline: 'Payment-First Offers',
    bullets: [
      'Low monthly payment creatives',
      'Approval confidence messaging',
      'Fast financing funnel',
    ],
  },
  {
    id: 'nearprime-warm',
    credit: ['C'],
    intent: ['Warm'],
    headline: 'Affordability + Credit Rebuild',
    bullets: [
      'Budget-friendly inventory',
      'Credit rebuild positioning',
      'Trade-in to lower payments',
    ],
  },
  {
    id: 'subprime-hot',
    credit: ['D', 'E'],
    intent: ['Hot', 'SuperHot'],
    headline: 'Guaranteed Credit + Rebate Ads',
    bullets: [
      'Guaranteed credit approval messaging',
      'Rebate + down payment matching',
      'Buy-here-pay-here CTA',
    ],
  },
  {
    id: 'subprime-warm',
    credit: ['D', 'E'],
    intent: ['Warm'],
    headline: 'Payment Relief + Entry Vehicles',
    bullets: [
      'Low down payment offers',
      'Affordable vehicle bundles',
      'SMS-first follow-ups',
    ],
  },
];

export const AdStrategyPanel = ({ creditRating, intentTier }: Props) => {
  const filtered = rules.filter((rule) => {
    const creditMatch = !creditRating || rule.credit.includes(creditRating);
    const intentMatch = !intentTier || rule.intent.includes(intentTier);
    return creditMatch && intentMatch;
  });

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg">Ad Strategy Recommendations</h3>
          <p className="text-sm text-white/60">
            {getCreditLabel(creditRating)} · {getIntentLabel(intentTier)}
          </p>
        </div>
        <span className="chip">Credit + Intent</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((rule) => (
          <div key={rule.id} className="border border-white/10 rounded-2xl p-4 bg-white/5">
            <h4 className="font-semibold">{rule.headline}</h4>
            <ul className="text-sm text-white/70 mt-3 space-y-2">
              {rule.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
