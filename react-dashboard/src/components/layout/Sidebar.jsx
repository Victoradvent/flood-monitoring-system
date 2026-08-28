import React from 'react';
import Icon from '../ui/Icon';

export default function Sidebar({
  active,
  onNavigate,
  onLogout,
  role
}) {
  const items = [
    ['dashboard', 'Dashboard', 'home'],
    ['map', 'Map', 'map'],
    ['alerts', 'Alerts', 'bell'],
    ['grid', 'Grid Monitor', 'grid'],
    ['reports', 'Reports', 'chart'],
    ['nodes', 'Nodes', 'server'],
    ['audit', 'Audit Logs', 'clipboard'],
    ['profile', 'Profile', 'user']
  ];

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-950 text-white">

      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Icon name="shield" size={22} />
        </div>

        <div>
          <div className="font-bold tracking-wide">
            FMS
          </div>

          <div className="text-[10px] uppercase tracking-[0.2em] text-blue-200">
            Flood Monitoring
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {items.map(([id, label, icon]) => {
          const isActive = active === id;

          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={[
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-100 hover:bg-white/10'
              ].join(' ')}
            >
              <Icon name={icon} size={17} />

              <span>{label}</span>

              {id === 'alerts' && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">
                  3
                </span>
              )}
            </button>
          );
        })}

        {/* Admin section */}
        {role === 'admin' && (
          <>
            <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
              Administration
            </div>

            <button
              onClick={() => onNavigate('admin')}
              className={[
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                active === 'admin'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-100 hover:bg-white/10'
              ].join(' ')}
            >
              <Icon name="shield" size={17} />

              <span>Administration</span>
            </button>
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-blue-100 transition hover:bg-white/10"
        >
          <Icon name="logout" size={17} />

          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}