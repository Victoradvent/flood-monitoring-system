export default function StatCard({title,value}){
return <div className="bg-white rounded-xl border p-5"><div className="text-xs text-slate-500">{title}</div><div className="text-3xl font-bold mt-2">{value}</div></div>
}