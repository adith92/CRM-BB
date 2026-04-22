import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const dict = {
  en: {
    // Nav
    nav_overview: "Overview",
    nav_fleet_dashboard: "Fleet HQ",
    nav_live_map: "Live Map",
    nav_vehicles: "Vehicles",
    nav_drivers: "Drivers",
    nav_trips: "Trips",
    nav_dashboard: "CRM Dashboard",
    nav_leads: "Leads",
    nav_pipeline: "Pipeline",
    nav_sales: "Sales",
    nav_contacts: "Contacts",
    nav_activities: "Activities",
    nav_calendar: "Calendar",
    nav_forms: "Forms",
    nav_settings: "Settings",
    // Executive dashboard
    fleet_hq: "Fleet Operations HQ",
    fleet_subtitle: "Real-time command center for your Jakarta fleet.",
    kpi_active_vehicles: "Active vehicles",
    kpi_on_duty_drivers: "Drivers on duty",
    kpi_trips_today: "Trips today",
    kpi_revenue_today: "Revenue today",
    vehicle_breakdown: "Fleet status",
    available: "Available",
    on_trip: "On trip",
    offline: "Offline",
    maintenance: "Maintenance",
    trips_per_hour: "Trips per hour",
    revenue_7d: "Revenue · last 7 days",
    live_map_preview: "Live map",
    live: "LIVE",
    open_full_map: "Open full map",
    recent_trips: "Recent trips",
    simulate_incoming: "Simulate incoming trip",
    // Map
    map_title: "Live Fleet Map",
    map_sub: "100 vehicles across Jakarta, updating every 2 seconds.",
    filter_all: "All",
    vehicle_popup_driver: "Driver",
    vehicle_popup_plate: "Plate",
    vehicle_popup_status: "Status",
    vehicle_popup_trip: "Current trip",
    none: "None",
    // Vehicles / Drivers / Trips
    vehicles_title: "Vehicles",
    drivers_title: "Drivers",
    trips_title: "Trips",
    new_vehicle: "New vehicle",
    new_driver: "New driver",
    new_trip: "New trip",
    plate: "Plate",
    model: "Model",
    type: "Type",
    status: "Status",
    driver: "Driver",
    actions: "Actions",
    name: "Name",
    phone: "Phone",
    rating: "Rating",
    total_trips: "Total trips",
    pickup: "Pickup",
    dropoff: "Drop-off",
    rider: "Rider",
    fare: "Fare",
    assign: "Assign",
    complete: "Complete",
    cancel: "Cancel",
    pending: "Pending",
    assigned: "Assigned",
    completed: "Completed",
    cancelled: "Cancelled",
    // Toasts
    saved: "Saved",
    deleted: "Deleted",
    error: "Something went wrong",
  },
  id: {
    nav_overview: "Ikhtisar",
    nav_fleet_dashboard: "Pusat Armada",
    nav_live_map: "Peta Real-time",
    nav_vehicles: "Kendaraan",
    nav_drivers: "Pengemudi",
    nav_trips: "Perjalanan",
    nav_dashboard: "Dasbor CRM",
    nav_leads: "Prospek",
    nav_pipeline: "Pipeline",
    nav_sales: "Penjualan",
    nav_contacts: "Kontak",
    nav_activities: "Aktivitas",
    nav_calendar: "Kalender",
    nav_forms: "Formulir",
    nav_settings: "Pengaturan",
    fleet_hq: "Pusat Operasi Armada",
    fleet_subtitle: "Pusat komando real-time untuk armada Jakarta Anda.",
    kpi_active_vehicles: "Kendaraan aktif",
    kpi_on_duty_drivers: "Pengemudi bertugas",
    kpi_trips_today: "Perjalanan hari ini",
    kpi_revenue_today: "Pendapatan hari ini",
    vehicle_breakdown: "Status armada",
    available: "Tersedia",
    on_trip: "Dalam perjalanan",
    offline: "Luring",
    maintenance: "Perawatan",
    trips_per_hour: "Perjalanan per jam",
    revenue_7d: "Pendapatan · 7 hari terakhir",
    live_map_preview: "Peta real-time",
    live: "LANGSUNG",
    open_full_map: "Buka peta penuh",
    recent_trips: "Perjalanan terbaru",
    simulate_incoming: "Simulasikan pesanan masuk",
    map_title: "Peta Armada Langsung",
    map_sub: "100 kendaraan di Jakarta, diperbarui setiap 2 detik.",
    filter_all: "Semua",
    vehicle_popup_driver: "Pengemudi",
    vehicle_popup_plate: "Pelat",
    vehicle_popup_status: "Status",
    vehicle_popup_trip: "Perjalanan saat ini",
    none: "Tidak ada",
    vehicles_title: "Kendaraan",
    drivers_title: "Pengemudi",
    trips_title: "Perjalanan",
    new_vehicle: "Kendaraan baru",
    new_driver: "Pengemudi baru",
    new_trip: "Perjalanan baru",
    plate: "Pelat",
    model: "Model",
    type: "Tipe",
    status: "Status",
    driver: "Pengemudi",
    actions: "Aksi",
    name: "Nama",
    phone: "Telepon",
    rating: "Rating",
    total_trips: "Total perjalanan",
    pickup: "Jemput",
    dropoff: "Tujuan",
    rider: "Penumpang",
    fare: "Tarif",
    assign: "Tugaskan",
    complete: "Selesai",
    cancel: "Batal",
    pending: "Menunggu",
    assigned: "Ditugaskan",
    completed: "Selesai",
    cancelled: "Dibatalkan",
    saved: "Tersimpan",
    deleted: "Dihapus",
    error: "Terjadi kesalahan",
  },
};

const I18nContext = createContext(null);
const ThemeContext = createContext(null);

export function AppProviders({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("relay_lang") || "en");
  const [theme, setTheme] = useState(() => localStorage.getItem("relay_theme") || "light");

  useEffect(() => {
    localStorage.setItem("relay_lang", lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("relay_theme", theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  const t = useCallback((key) => (dict[lang] && dict[lang][key]) || dict.en[key] || key, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      <ThemeContext.Provider value={{ theme, setTheme, toggleTheme: () => setTheme((x) => x === "dark" ? "light" : "dark") }}>
        {children}
      </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
export const useTheme = () => useContext(ThemeContext);
