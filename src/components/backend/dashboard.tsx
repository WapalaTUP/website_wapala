import Link from "next/link";
import {
  ArrowUpRight,
  Users,
  Package,
  ClipboardCheck,
  UserPlus,
  HeartHandshake,
} from "lucide-react";
const icons = {
  "/admin/anggota": Users,
  "/admin/inventaris": Package,
  "/admin/peminjaman": ClipboardCheck,
  "/admin/or": UserPlus,
  "/admin/donasi": HeartHandshake,
};
export function BackendDashboard({
  name,
  counts,
}: {
  name: string;
  counts: Array<{ label: string; value: number; href: string }>;
}) {
  return (
    <section className="admin-dashboard" aria-label="Ringkasan organisasi">
      <div className="dashboard-intro">
        <h2>Ringkasan organisasi</h2>
        <p>
          Selamat datang, {name}. Kelola kegiatan dan administrasi melalui
          navigasi di samping.
        </p>
      </div>
      <div className="dashboard-metrics">
        {counts.map((c) => {
          const Icon = icons[c.href as keyof typeof icons] || ClipboardCheck;
          return (
            <Link
              key={c.href}
              className="dashboard-metric"
              href={c.href}
              aria-label={c.label + ": " + c.value + ". Buka modul"}
            >
              <div className="dashboard-metric-top">
                <Icon size={23} aria-hidden="true" />
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
              <span className="dashboard-metric-value">
                {c.value.toLocaleString("id-ID")}
              </span>
              <h3>{c.label}</h3>
              <span className="dashboard-metric-link">Buka modul</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
