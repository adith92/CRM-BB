import React from "react";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || "U").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Account</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 mt-1">Settings</h1>
      </div>

      <Card className="p-6 rounded-md border border-zinc-200 shadow-none">
        <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium mb-4">Profile</div>
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 rounded-md">
            {user?.picture ? <AvatarImage src={user.picture} alt={user.name} /> : null}
            <AvatarFallback className="rounded-md bg-zinc-900 text-white text-base">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-display font-semibold text-zinc-900">{user?.name}</div>
            <div className="text-sm text-zinc-600">{user?.email}</div>
            <div className="text-xs text-zinc-500 mt-0.5 uppercase tracking-wider">{user?.role}</div>
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-md border border-zinc-200 shadow-none">
        <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium mb-4">Workspace</div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-zinc-500">Company</span><span className="font-medium text-zinc-900">{user?.company_name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-zinc-500">Company ID</span><span className="font-mono text-zinc-700">{user?.company_id}</span></div>
          <div className="flex justify-between text-sm"><span className="text-zinc-500">User ID</span><span className="font-mono text-zinc-700">{user?.user_id}</span></div>
        </div>
      </Card>

      <Card className="p-6 rounded-md border border-zinc-200 shadow-none">
        <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium mb-3">Session</div>
        <p className="text-sm text-zinc-600 mb-4">Sign out from this device.</p>
        <Button
          variant="outline"
          onClick={async () => { await logout(); navigate("/login"); }}
          data-testid="settings-logout"
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
}
