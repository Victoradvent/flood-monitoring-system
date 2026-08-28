const styles = {
  NORMAL: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  OK: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  WARNING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  CRITICAL: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};
export default function Badge({ children, value }) {
  const label = value ?? children ?? 'NORMAL';
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles[label] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>{label}</span>;
}
