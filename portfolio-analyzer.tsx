import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Area, AreaChart
} from "recharts";

const CATEGORIES = ["Stock", "Bond", "Crypto", "Cash"];
const CAT = {
  Stock:  { badge: "bg-blue-100 text-blue-700",   hex: "#3b82f6" },
  Bond:   { badge: "bg-green-100 text-green-700",  hex: "#22c55e" },
  Crypto: { badge: "bg-purple-100 text-purple-700",hex: "#a855f7" },
  Cash:   { badge: "bg-gray-100 text-gray-600",    hex: "#94a3b8" },
};
const MONTHS = ["Mar'24","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan'25","Feb","Mar'25"];

const fmt  = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${fmt(n)}`;
const emptyAsset = () => ({ id: Date.now(), name: "", category: "Stock", amount: "", price: "", purchase: "" });

// Generate a realistic seeded random walk for 13 months
function genTrend(seed, base) {
  let v = base, s = seed;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return MONTHS.map((m, i) => {
    if (i > 0) v = Math.max(v * (0.93 + rng() * 0.16), 500);
    return { month: m, value: Math.round(v) };
  });
}

const INITIAL = [
  { id: 1, name: "Apple Inc.",       category: "Stock",  amount: "10",   price: "189.50", purchase: "150.00" },
  { id: 2, name: "US Treasury Bond", category: "Bond",   amount: "5",    price: "1020.00",purchase: "1000.00"},
  { id: 3, name: "Bitcoin",          category: "Crypto", amount: "0.25", price: "67400.00",purchase:"45000.00"},
  { id: 4, name: "Cash Reserve",     category: "Cash",   amount: "1",    price: "5000.00", purchase: "5000.00"},
];

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, payload: p } = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{name}</p>
      <p className="text-gray-500">Value: <span className="font-medium text-gray-800">${fmt(p.value)}</span></p>
      <p className="text-gray-500">Weight: <span className="font-medium text-gray-800">{fmt(p.weight)}%</span></p>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-blue-600 font-bold">{fmtK(payload[0].value)}</p>
    </div>
  );
};

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, weight }) => {
  if (weight < 5) return null;
  const R = Math.PI / 180, r = innerRadius + (outerRadius - innerRadius) * 0.55;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="600">
      {fmt(weight)}%
    </text>
  );
};

export default function App() {
  const [assets, setAssets] = useState(INITIAL);

  const total = useMemo(() =>
    assets.reduce((s, a) => s + (parseFloat(a.amount)||0)*(parseFloat(a.price)||0), 0), [assets]);

  const totalCost = useMemo(() =>
    assets.reduce((s, a) => s + (parseFloat(a.amount)||0)*(parseFloat(a.purchase)||0), 0), [assets]);

  const enriched = useMemo(() => assets.map(a => {
    const amt = parseFloat(a.amount)||0, cur = parseFloat(a.price)||0, pur = parseFloat(a.purchase)||0;
    const tv = amt * cur, cost = amt * pur;
    const pl = tv - cost, plPct = cost > 0 ? (pl / cost) * 100 : null;
    return { ...a, totalValue: tv, cost, pl, plPct, weight: total > 0 ? (tv/total)*100 : 0 };
  }), [assets, total]);

  const catBreak = useMemo(() => {
    const m = {}; CATEGORIES.forEach(c => m[c]=0);
    enriched.forEach(a => { m[a.category] += a.totalValue; });
    return m;
  }, [enriched]);

  const pieData = useMemo(() =>
    CATEGORIES.map(c => ({ name:c, value:catBreak[c], weight: total>0?(catBreak[c]/total)*100:0 })).filter(d=>d.value>0),
    [catBreak, total]);

  const topAsset = useMemo(() =>
    enriched.length ? enriched.reduce((b,a) => a.weight>b.weight?a:b, enriched[0]) : null, [enriched]);

  const totalPL = total - totalCost;
  const totalPLpct = totalCost > 0 ? (totalPL / totalCost) * 100 : null;

  // Regenerate trend whenever total changes (keyed on rounded total)
  const trendData = useMemo(() => {
    const seed = Math.round(total / 100) || 42;
    const base = total > 0 ? total * 0.72 : 20000;
    const raw = genTrend(seed, base);
    // Pin last point to current total
    const scale = total > 0 ? total / raw[raw.length-1].value : 1;
    return raw.map((p,i) => i === raw.length-1 ? { ...p, value: Math.round(total) } : { ...p, value: Math.round(p.value * scale) });
  }, [Math.round(total / 500)]);

  const trendMin = useMemo(() => Math.min(...trendData.map(d=>d.value)) * 0.95, [trendData]);
  const trendMax = useMemo(() => Math.max(...trendData.map(d=>d.value)) * 1.05, [trendData]);

  const update = (id, f, v) => setAssets(p => p.map(a => a.id===id ? {...a,[f]:v} : a));
  const addRow  = () => setAssets(p => [...p, emptyAsset()]);
  const removeRow=(id)=> setAssets(p => p.filter(a=>a.id!==id));

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Portfolio Analyzer</h1>
            <p className="text-xs text-gray-500">Personal Asset Management</p>
          </div>
        </div>
        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full font-medium">Live</span>
      </div>

      <div className="px-8 py-6 max-w-6xl mx-auto space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-blue-600 rounded-xl p-5 text-white col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-1">Total Net Worth</p>
            <p className="text-2xl font-bold">${fmt(total)}</p>
            <p className="text-xs text-blue-200 mt-1">Across all asset classes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Total P/L</p>
            <p className={`text-2xl font-bold ${totalPL >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {totalPL >= 0 ? "+" : ""}${fmt(totalPL)}
            </p>
            <p className={`text-xs mt-1 font-medium ${totalPL >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              {totalPLpct !== null ? `${totalPL>=0?"+":""}${fmt(totalPLpct)}% overall` : "—"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">No. of Assets</p>
            <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {CATEGORIES.map(c => { const n=assets.filter(a=>a.category===c).length; return n>0?<span key={c} className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT[c].badge}`}>{n} {c}</span>:null; })}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Top Holding</p>
            {topAsset ? <>
              <p className="text-base font-bold text-gray-900 truncate">{topAsset.name || <span className="text-gray-400 italic text-sm">Unnamed</span>}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT[topAsset.category].badge}`}>{topAsset.category}</span>
                <span className="text-xs text-gray-500">{fmt(topAsset.weight)}%</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{width:`${Math.min(topAsset.weight,100)}%`}}/>
              </div>
            </> : <p className="text-gray-400 text-sm">No assets yet</p>}
          </div>
        </div>

        {/* Analytics Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Category Distribution</p>
            <p className="text-xs text-gray-400 mb-4">Portfolio weight by asset class</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={95} innerRadius={48}
                    dataKey="value" labelLine={false} label={<PieLabel/>} strokeWidth={2} stroke="#f9fafb">
                    {pieData.map(e => <Cell key={e.name} fill={CAT[e.name].hex}/>)}
                  </Pie>
                  <Tooltip content={<PieTooltip/>}/>
                  <Legend iconType="circle" iconSize={8}
                    formatter={v => <span style={{fontSize:12,color:"#6b7280"}}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-56 flex items-center justify-center text-gray-300 text-sm">Add assets to see chart</div>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Allocation Breakdown</p>
            <p className="text-xs text-gray-400 mb-4">Value and weight per asset class</p>
            <div className="space-y-4">
              {CATEGORIES.map(cat => {
                const val = catBreak[cat], pct = total > 0 ? (val/total)*100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:CAT[cat].hex}}/>
                        <span className="text-sm font-medium text-gray-700">{cat}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-800">${fmt(val)}</span>
                        <span className="text-xs text-gray-400 ml-2">{fmt(pct)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-300" style={{width:`${Math.min(pct,100)}%`,backgroundColor:CAT[cat].hex}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6">
              <p className="text-xs text-gray-400 mb-2">Combined view</p>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {CATEGORIES.map(cat => { const pct=total>0?(catBreak[cat]/total)*100:0; return pct>0?<div key={cat} className="transition-all duration-300 h-3" style={{width:`${pct}%`,backgroundColor:CAT[cat].hex}}/>:null; })}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Asset Holdings</p>
            <button onClick={addRow} className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
              </svg>
              Add Asset
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Asset Name</th>
                  <th className="text-left px-3 py-3 font-semibold">Category</th>
                  <th className="text-right px-3 py-3 font-semibold">Amount</th>
                  <th className="text-right px-3 py-3 font-semibold">Purchase $</th>
                  <th className="text-right px-3 py-3 font-semibold">Current $</th>
                  <th className="text-right px-3 py-3 font-semibold">Total Value</th>
                  <th className="text-right px-3 py-3 font-semibold">Weight</th>
                  <th className="text-right px-3 py-3 font-semibold">P/L</th>
                  <th className="text-right px-3 py-3 font-semibold">P/L %</th>
                  <th className="px-3 py-3"/>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enriched.map(a => {
                  const profit = a.pl >= 0;
                  const hasP = parseFloat(a.purchase) > 0 && parseFloat(a.amount) > 0;
                  return (
                    <tr key={a.id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="px-4 py-3">
                        <input className="w-full bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-gray-800 font-medium placeholder-gray-300 px-1 py-0.5 rounded transition"
                          placeholder="e.g. Apple Inc." value={a.name} onChange={e=>update(a.id,"name",e.target.value)}/>
                      </td>
                      <td className="px-3 py-3">
                        <select className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${CAT[a.category].badge}`}
                          value={a.category} onChange={e=>update(a.id,"category",e.target.value)}>
                          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" className="w-20 bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-right text-gray-700 placeholder-gray-300 px-1 py-0.5 rounded transition"
                          placeholder="0" value={a.amount} onChange={e=>update(a.id,"amount",e.target.value)} min="0"/>
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" className="w-24 bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-right text-gray-700 placeholder-gray-300 px-1 py-0.5 rounded transition"
                          placeholder="0.00" value={a.purchase} onChange={e=>update(a.id,"purchase",e.target.value)} min="0"/>
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" className="w-24 bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-right text-gray-700 placeholder-gray-300 px-1 py-0.5 rounded transition"
                          placeholder="0.00" value={a.price} onChange={e=>update(a.id,"price",e.target.value)} min="0"/>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-gray-800">${fmt(a.totalValue)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{width:`${Math.min(a.weight,100)}%`}}/>
                          </div>
                          <span className="text-gray-700 font-medium w-10 text-right">{fmt(a.weight)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {hasP ? (
                          <span className={`font-semibold ${profit?"text-emerald-600":"text-red-500"}`}>
                            {profit?"+":""}{fmt(a.pl)}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {hasP && a.plPct !== null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${profit?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-500"}`}>
                            {profit?"▲":"▼"} {fmt(Math.abs(a.plPct))}%
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={()=>removeRow(a.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {assets.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">
                    No assets yet. Click <span className="text-blue-500 font-medium">+ Add Asset</span> to get started.
                  </td></tr>
                )}
              </tbody>
              {assets.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-sm">
                    <td className="px-4 py-3 text-gray-700" colSpan={5}>Total Portfolio</td>
                    <td className="px-3 py-3 text-right text-blue-700 text-base">${fmt(total)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">100.00%</td>
                    <td className={`px-3 py-3 text-right font-bold ${totalPL>=0?"text-emerald-600":"text-red-500"}`}>
                      {totalPL>=0?"+":""}{fmt(totalPL)}
                    </td>
                    <td className={`px-3 py-3 text-right`}>
                      {totalPLpct !== null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${totalPL>=0?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-500"}`}>
                          {totalPL>=0?"▲":"▼"} {fmt(Math.abs(totalPLpct))}%
                        </span>
                      ) : "—"}
                    </td>
                    <td/>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Performance Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-sm font-semibold text-gray-800">Portfolio Performance Trend</p>
              <p className="text-xs text-gray-400 mt-0.5">Simulated 13-month trajectory · updates with your portfolio value</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Current Value</p>
              <p className="text-base font-bold text-blue-600">${fmt(total)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mb-5 mt-3">
            {(() => {
              const first = trendData[0]?.value, last = trendData[trendData.length-1]?.value;
              const chg = last - first, chgPct = first > 0 ? (chg/first)*100 : 0;
              const up = chg >= 0;
              return <>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${up?"bg-emerald-50 text-emerald-600":"bg-red-50 text-red-500"}`}>
                  {up?"▲":"▼"} {fmt(Math.abs(chgPct))}% over 13 months
                </span>
                <span className={`text-xs font-semibold ${up?"text-emerald-600":"text-red-500"}`}>
                  {up?"+":""}{fmtK(chg)} total change
                </span>
              </>;
            })()}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{top:4,right:8,left:0,bottom:0}}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="month" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis domain={[trendMin, trendMax]} tickFormatter={fmtK} tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false} width={52}/>
              <ReTooltip content={<LineTooltip/>}/>
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#blueGrad)" dot={false} activeDot={{r:5,fill:"#3b82f6",strokeWidth:2,stroke:"#fff"}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">All data is stored in-session. Performance trend is simulated. Prices are entered manually.</p>
      </div>
    </div>
  );
}
