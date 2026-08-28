import React, { useState } from 'react';
import { requestPermission } from './notifications';
import Icon from './components/ui/Icon';

export default function Login({ onLogin }) {
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const submit=async e=>{
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username.trim(),password})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Login failed');
      if(!data.token) throw new Error('Login response did not include a token');
      const decoded=JSON.parse(atob(data.token.split('.')[1]));
      localStorage.setItem('jwt',data.token); localStorage.setItem('role',decoded.role);
      requestPermission(); onLogin(data.token,decoded.role);
    } catch(err){ setError(err.message||'Login failed'); }
    finally{ setLoading(false); }
  };

  return <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
    <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1420px] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-300/50 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0a3a69] via-[#075b96] to-[#0d2e4d] lg:flex">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 30% 20%, white 1px, transparent 1px)',backgroundSize:'26px 26px'}}/>
        <div className="absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"/>
        <div className="relative z-10 flex w-full flex-col justify-between p-14 text-white">
          <div className="max-w-xl"><div className="mb-7 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10"><Icon name="shield" size={30}/></div><span className="text-sm font-bold uppercase tracking-[.25em]">FMS</span></div><h1 className="max-w-lg text-5xl font-extrabold leading-tight tracking-tight">Flood Monitoring<br/>System</h1><div className="mt-6 h-1 w-16 rounded-full bg-blue-300"/><p className="mt-6 max-w-md text-lg leading-8 text-blue-50">Real-time monitoring, alerts and intelligent risk management for a safer tomorrow.</p></div>
          <div className="grid grid-cols-3 divide-x divide-white/25 rounded-xl border border-white/10 bg-slate-950/15 p-5 backdrop-blur-sm"><Feature icon="water" title={<>Real-time<br/>Monitoring</>}/><Feature icon="bell" title={<>Instant<br/>Alerts</>}/><Feature icon="lightning" title={<>Grid Risk<br/>Management</>}/></div>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:px-16">
        <div className="w-full max-w-[500px]">
          <div className="text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon name="shield" size={54}/></div><h2 className="mt-7 text-3xl font-extrabold tracking-tight text-[#0b2e5b]">Welcome Back</h2><p className="mt-2 text-base text-slate-500">Sign in to your account to continue</p></div>
          <form onSubmit={submit} className="mt-10 space-y-5">
            <label className="block"><span className="sr-only">Username</span><div className="flex items-center gap-3 rounded-lg border border-slate-300 px-4 py-3.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"><Icon name="profile" size={21} className="text-slate-400"/><input className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} required/></div></label>
            <label className="block"><span className="sr-only">Password</span><div className="flex items-center gap-3 rounded-lg border border-slate-300 px-4 py-3.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"><Icon name="shield" size={21} className="text-slate-400"/><input className="w-full border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600">{showPassword?'Hide':'Show'}</button></div></label>
            <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>Remember me</label><button type="button" className="font-medium text-blue-600 hover:text-blue-700">Forgot password?</button></div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button disabled={loading} className="primary-btn w-full py-3.5 text-base">{loading?'Signing in…':'LOGIN'}<Icon name="logout" size={19}/></button>
          </form>
          <div className="my-7 flex items-center gap-4 text-sm text-slate-400"><div className="h-px flex-1 bg-slate-200"/>or<div className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" onClick={()=>{setUsername('operator');setPassword('');setError('');}} className="secondary-btn w-full border-blue-300 py-3.5 text-blue-600 hover:bg-blue-50"><Icon name="profile"/>Login as Operator</button>
          <p className="mt-10 text-center text-xs text-slate-400">© 2025 Flood Monitoring System. All rights reserved.</p>
        </div>
      </div>
    </div>
  </div>;
}
function Feature({icon,title}){return <div className="flex flex-col items-center gap-2 px-3 text-center"><Icon name={icon} size={30}/><span className="text-sm font-semibold leading-5 text-blue-50">{title}</span></div>}
