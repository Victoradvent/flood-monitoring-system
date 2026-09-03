import Icon from "../ui/Icon";
export default function Header({ title, role, onMenu, onLogout }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          onClick={onMenu}
        >
          <Icon name="menu" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900 sm:text-lg">
            {title}
          </h1>
          <p className="hidden text-xs text-slate-500 sm:block">
            Real-time flood and grid risk monitoring
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Icon name="bell" size={18} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Icon name="profile" size={16} />
          </span>
          <span className="hidden sm:inline">{role || "User"}</span>
          <span className="text-slate-400">⌄</span>
        </button>
      </div>
    </header>
  );
}
