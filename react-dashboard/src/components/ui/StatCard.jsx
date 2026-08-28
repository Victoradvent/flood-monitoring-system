import Icon from './Icon';
const tones = {
  blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', slate: 'bg-slate-100 text-slate-600'
};
export default function StatCard({ title, value, tone='blue', icon='dashboard', trend }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div><div className={`rounded-lg p-2.5 ${tones[tone] || tones.blue}`}><Icon name={icon} size={19}/></div></div>
    {trend && <p className="mt-2 text-xs text-slate-500">{trend}</p>}
  </div>;
}
