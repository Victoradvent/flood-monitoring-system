export default function Card({title,children}){
return <div className="bg-white rounded-xl border shadow-sm"><div className="p-4 border-b font-semibold">{title}</div><div className="p-4">{children}</div></div>
}