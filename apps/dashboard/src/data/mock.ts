export const kpis = [
  {
    label: "Contact rate",
    value: "34%",
    delta: "+6%",
    trend: "up"
  },
  {
    label: "Warm transfers",
    value: "128",
    delta: "+12",
    trend: "up"
  },
  {
    label: "Appointments booked",
    value: "86",
    delta: "-4",
    trend: "down"
  },
  {
    label: "Avg time-to-contact",
    value: "3m 12s",
    delta: "-38s",
    trend: "up"
  }
];

export const activityFeed = [
  {
    id: "evt-1",
    time: "2 min ago",
    title: "Warm transfer completed",
    detail: "Toyota of Plano → Andrea W. | 2024 RAV4",
    tone: "success"
  },
  {
    id: "evt-2",
    time: "8 min ago",
    title: "Lead reached voicemail",
    detail: "Carson Honda → Chris J. | 2022 CR-V",
    tone: "neutral"
  },
  {
    id: "evt-3",
    time: "16 min ago",
    title: "Appointment scheduled",
    detail: "Southside Ford → 4:30 PM, Mon",
    tone: "success"
  },
  {
    id: "evt-4",
    time: "31 min ago",
    title: "Opt-out received",
    detail: "Bay Area Mazda → SMS opt-out logged",
    tone: "alert"
  }
];

export const funnel = [
  { label: "High intent", value: 420 },
  { label: "Calls attempted", value: 356 },
  { label: "Contacts", value: 122 },
  { label: "Warm transfers", value: 68 },
  { label: "Appointments", value: 44 }
];

export const reps = [
  {
    name: "Andrea Wallace",
    store: "Toyota of Plano",
    transfers: 28,
    contactRate: "41%",
    sentiment: "Strong"
  },
  {
    name: "Marcus Lee",
    store: "Southside Ford",
    transfers: 22,
    contactRate: "36%",
    sentiment: "Steady"
  },
  {
    name: "Olivia Chen",
    store: "Carson Honda",
    transfers: 18,
    contactRate: "32%",
    sentiment: "Improving"
  }
];

export const queue = [
  {
    lead: "Samir Q.",
    vehicle: "2024 Civic Touring",
    store: "Carson Honda",
    score: 88,
    status: "Call window opens in 12m"
  },
  {
    lead: "Lena B.",
    vehicle: "2025 F-150 Lariat",
    store: "Southside Ford",
    score: 82,
    status: "Retry scheduled at 2:20 PM"
  },
  {
    lead: "Diego M.",
    vehicle: "2023 CX-5 Carbon",
    store: "Bay Area Mazda",
    score: 77,
    status: "Transfer pending rep acceptance"
  }
];

export const alerts = [
  {
    title: "Call window drift detected",
    detail: "2 stores crossing local quiet hours in 45 mins",
    tag: "Timezones"
  },
  {
    title: "Routing rule conflict",
    detail: "Toyota of Plano has two active rules for SUV leads",
    tag: "Routing"
  },
  {
    title: "Lead spike",
    detail: "High-intent events up 28% in the last 2 hours",
    tag: "Demand"
  }
];
