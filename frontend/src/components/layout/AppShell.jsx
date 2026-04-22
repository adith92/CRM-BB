import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Briefcase, Building2, CheckSquare, Settings as SettingsIcon,
  Search, Bell, Plus, LogOut, PanelLeftClose, PanelLeftOpen, Hexagon, ChevronDown
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import GlobalSearch from "../GlobalSearch";
import QuickCreate from "../QuickCreate";
import NotificationsPopover from "../NotificationsPopover";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
  { to: "/pipeline", label: "Pipeline", icon: Briefcase, testid: "nav-pipeline" },
  { to: "/contacts", label: "Contacts", icon: Building2, testid: "nav-contacts" },
  { to: "/activities", label: "Activities", icon: CheckSquare, testid: "nav-activities" },
];

function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-zinc-200 bg-zinc-50 transition-[width] duration-200 ${collapsed ? "w-16" : "w-64"}`}
      data-testid="sidebar"
    >
      <div className={`h-16 flex items-center border-b border-zinc-200 ${collapsed ? "justify-center" : "px-5"}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-900 text-white flex items-center justify-center">
            <Hexagon className="w-4 h-4" strokeWidth={1.8} />
          </div>
          {!collapsed && <span className="font-display font-bold text-zinc-900 tracking-tight">Relay</span>}
        </div>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-testid={item.testid}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-zinc-900 border border-zinc-200 shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              } ${collapsed ? "justify-center" : ""}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={`border-t border-zinc-200 p-2 ${collapsed ? "flex justify-center" : ""}`}>
        <NavLink
          to="/settings"
          data-testid="nav-settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive ? "bg-white text-zinc-900 border border-zinc-200" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            } ${collapsed ? "justify-center w-auto" : "w-full"}`
          }
        >
          <SettingsIcon className="w-[18px] h-[18px]" strokeWidth={1.6} />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
      <button
        onClick={onToggle}
        data-testid="sidebar-toggle"
        className="h-10 border-t border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center"
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
    </aside>
  );
}

function MobileBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-zinc-200 flex"
      data-testid="mobile-bottom-nav"
    >
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              isActive ? "text-zinc-900" : "text-zinc-500"
            }`
          }
          data-testid={`mobile-${item.testid}`}
        >
          <item.icon className="w-5 h-5" strokeWidth={1.6} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Topbar({ onOpenSearch }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.name || user?.email || "U").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header
      className="fixed top-0 right-0 left-0 h-16 bg-white border-b border-zinc-200 z-20 flex items-center px-4 md:px-6 gap-3 md:pl-[calc(var(--sidebar-w,16rem)+1.5rem)]"
      data-testid="topbar"
    >
      <button
        onClick={onOpenSearch}
        data-testid="open-global-search"
        className="flex-1 max-w-xl flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 text-sm"
      >
        <Search className="w-4 h-4" />
        <span>Search leads, contacts, opps…</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] font-mono bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200">⌘K</span>
      </button>

      <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
        <QuickCreate />
        <NotificationsPopover />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-1.5 rounded-md hover:bg-zinc-100" data-testid="profile-menu">
              <Avatar className="w-7 h-7 rounded-md">
                {user?.picture ? <AvatarImage src={user.picture} alt={user.name} /> : null}
                <AvatarFallback className="rounded-md bg-zinc-900 text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium text-zinc-900">{user?.name}</div>
              <div className="text-xs text-zinc-500 font-normal">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="profile-settings">
              <SettingsIcon className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="logout-btn"
              onClick={async () => { await logout(); navigate("/login"); }}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sidebarWidth = collapsed ? "4rem" : "16rem";

  return (
    <div className="min-h-screen bg-white" style={{ "--sidebar-w": sidebarWidth }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar onOpenSearch={() => setSearchOpen(true)} />
      <main
        className="pt-16 pb-20 md:pb-0 min-h-screen bg-white transition-[padding] duration-200 md:pl-[var(--sidebar-w,16rem)]"
      >
        <div key={location.pathname} className="fade-in-up">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
