import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Briefcase, Building2, CheckSquare, Settings as SettingsIcon,
  Search, Plus, LogOut, PanelLeftClose, PanelLeftOpen, Hexagon, ChevronDown,
  CalendarDays, FileText, Inbox, Map as MapIcon, Car, UserCheck, Route as RouteIcon,
  Radar, Moon, Sun, Languages
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n, useTheme } from "../../contexts/AppContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import GlobalSearch from "../GlobalSearch";
import QuickCreate from "../QuickCreate";
import NotificationsPopover from "../NotificationsPopover";

function navSections(t) {
  return [
    {
      heading: t("nav_overview"),
      items: [
        { to: "/fleet", label: t("nav_fleet_dashboard"), icon: Radar, testid: "nav-fleet" },
        { to: "/map", label: t("nav_live_map"), icon: MapIcon, testid: "nav-map" },
        { to: "/vehicles", label: t("nav_vehicles"), icon: Car, testid: "nav-vehicles" },
        { to: "/drivers", label: t("nav_drivers"), icon: UserCheck, testid: "nav-drivers" },
        { to: "/trips", label: t("nav_trips"), icon: RouteIcon, testid: "nav-trips" },
      ],
    },
    {
      heading: "CRM",
      items: [
        { to: "/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard, testid: "nav-dashboard" },
        { to: "/leads", label: t("nav_leads"), icon: Users, testid: "nav-leads" },
        { to: "/pipeline", label: t("nav_pipeline"), icon: Briefcase, testid: "nav-pipeline" },
        { to: "/sales", label: t("nav_sales"), icon: FileText, testid: "nav-sales" },
        { to: "/contacts", label: t("nav_contacts"), icon: Building2, testid: "nav-contacts" },
        { to: "/activities", label: t("nav_activities"), icon: CheckSquare, testid: "nav-activities" },
        { to: "/calendar", label: t("nav_calendar"), icon: CalendarDays, testid: "nav-calendar" },
        { to: "/forms", label: t("nav_forms"), icon: Inbox, testid: "nav-forms" },
      ],
    },
  ];
}

function mobileNav(t) {
  return [
    { to: "/fleet", label: "HQ", icon: Radar, testid: "mobile-nav-fleet" },
    { to: "/map", label: "Map", icon: MapIcon, testid: "mobile-nav-map" },
    { to: "/vehicles", label: t("nav_vehicles"), icon: Car, testid: "mobile-nav-vehicles" },
    { to: "/trips", label: t("nav_trips"), icon: RouteIcon, testid: "mobile-nav-trips" },
    { to: "/dashboard", label: "CRM", icon: LayoutDashboard, testid: "mobile-nav-crm" },
  ];
}

function Sidebar({ collapsed, onToggle }) {
  const { t } = useI18n();
  const sections = navSections(t);
  return (
    <aside
      className={`hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border bg-secondary/40 transition-[width] duration-200 ${collapsed ? "w-16" : "w-64"}`}
      data-testid="sidebar"
    >
      <div className={`h-16 flex items-center border-b border-border ${collapsed ? "justify-center" : "px-5"}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center">
            <Hexagon className="w-4 h-4" strokeWidth={1.8} />
          </div>
          {!collapsed && <span className="font-display font-bold tracking-tight">Relay</span>}
        </div>
      </div>
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.heading}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{sec.heading}</div>
            )}
            <div className="space-y-0.5">
              {sec.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-testid={item.testid}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-card text-foreground border border-border shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    } ${collapsed ? "justify-center" : ""}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className={`border-t border-border p-2 ${collapsed ? "flex justify-center" : ""}`}>
        <NavLink
          to="/settings"
          data-testid="nav-settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            } ${collapsed ? "justify-center w-auto" : "w-full"}`
          }
        >
          <SettingsIcon className="w-[18px] h-[18px]" strokeWidth={1.6} />
          {!collapsed && <span>{t("nav_settings")}</span>}
        </NavLink>
      </div>
      <button
        onClick={onToggle}
        data-testid="sidebar-toggle"
        className="h-10 border-t border-border text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center"
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
      </button>
    </aside>
  );
}

function MobileBottomNav() {
  const { t } = useI18n();
  const items = mobileNav(t);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-card border-t border-border flex" data-testid="mobile-bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}
          data-testid={item.testid}
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
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const initials = (user?.name || user?.email || "U").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header
      className="fixed top-0 right-0 left-0 h-16 bg-card/80 backdrop-blur-md border-b border-border z-20 flex items-center px-4 md:px-6 gap-2 md:pl-[calc(var(--sidebar-w,16rem)+1.5rem)]"
      data-testid="topbar"
    >
      <button
        onClick={onOpenSearch}
        data-testid="open-global-search"
        className="flex-1 max-w-xl flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-muted-foreground text-sm"
      >
        <Search className="w-4 h-4" />
        <span className="truncate">Search fleet, leads, trips…</span>
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">⌘K</span>
      </button>

      <div className="flex items-center gap-1 md:gap-1.5 ml-auto">
        <QuickCreate />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className="h-9 w-9 rounded-md hover:bg-accent inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Language switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-9 px-2 rounded-md hover:bg-accent inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              data-testid="lang-toggle"
              aria-label="Language"
            >
              <Languages className="w-[18px] h-[18px]" />
              <span className="text-xs font-mono uppercase">{lang}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={lang} onValueChange={setLang}>
              <DropdownMenuRadioItem value="en" data-testid="lang-en">English</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="id" data-testid="lang-id">Bahasa Indonesia</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsPopover />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-9 px-1.5 rounded-md hover:bg-accent" data-testid="profile-menu">
              <Avatar className="w-7 h-7 rounded-md">
                {user?.picture ? <AvatarImage src={user.picture} alt={user.name} /> : null}
                <AvatarFallback className="rounded-md bg-foreground text-background text-xs">{initials}</AvatarFallback>
              </Avatar>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="profile-settings">
              <SettingsIcon className="w-4 h-4 mr-2" /> {t("nav_settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="logout-btn" onClick={async () => { await logout(); navigate("/login"); }} className="text-red-600 focus:text-red-600">
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
    <div className="min-h-screen bg-background text-foreground" style={{ "--sidebar-w": sidebarWidth }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <Topbar onOpenSearch={() => setSearchOpen(true)} />
      <main className="pt-16 pb-20 md:pb-0 min-h-screen bg-background transition-[padding] duration-200 md:pl-[var(--sidebar-w,16rem)]">
        <div key={location.pathname} className="fade-in-up">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
