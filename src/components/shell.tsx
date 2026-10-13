"use client";
import { activeCampaigns } from "@/lib/campaigns";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Moon,
  Sun,
  Instagram,
  Youtube,
  Mail,
  ChevronDown,
} from "lucide-react";
import { divisions } from "@/lib/content";
import { useTheme } from "./providers";
import { useDemo } from "@/lib/store";
export function Logo() {
  const { settings } = useDemo();
  return (
    <Link href="/" className="brand" aria-label="WAPALA, beranda">
      <span className="logo-panel">
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo WAPALA"
            width={38}
            height={57}
          />
        ) : (
          <span className="logo-mark" aria-hidden="true">
            W
          </span>
        )}
      </span>
      <span>
        <strong>WAHANA PENCINTA ALAM</strong>
        <small>Telkom University</small>
      </span>
    </Link>
  );
}
export function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="icon-btn theme-btn"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"
      }
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState("");
  const state = useDemo();
  const groups = [
    {
      label: "Tentang",
      links: [
        ["Profil WAPALA", "/profil"],
        ["Sejarah & visi", "/profil#sejarah"],
        ["Seluruh angkatan", "/profil#angkatan"],
      ],
    },
    {
      label: "Divisi",
      links: divisions.map((d) => [d.name, "/divisi/" + d.slug]),
    },
    {
      label: "Kabar",
      links: [
        ["Berita kegiatan", "/berita"],
        ["Pengumuman", "/announcement"],
      ],
    },
    {
      label: "Dokumentasi",
      links: [
        ["Galeri foto", "/galeri"],
        ["Buku publik", "/buku"],
      ],
    },
    {
      label: "Layanan",
      links: [
        ["Peminjaman alat", "/peminjaman"],
        ["Lacak pengajuan", "/peminjaman/status"],
      ],
    },
  ];
  const close = () => {
    setOpen(false);
    setExpanded("");
  };
  useEffect(() => {
    if (!open && !expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setExpanded("");
      }
    };
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".site-header")) {
        setOpen(false);
        setExpanded("");
      }
    };
    document.addEventListener("keydown", handler);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, expanded]);
  return (
    <>
      <a href="#main" className="skip-link">
        Langsung ke konten
      </a>
      <header
        className={
          "site-header" +
          (state.settings.recruitmentActive ? " has-recruitment" : "") +
          (activeCampaigns(state).length ? " has-donation" : "")
        }
      >
        <div className="header-inner">
          <Logo />
          <nav
            className={"public-nav" + (open ? " is-open" : "")}
            aria-label="Navigasi utama"
            id="main-navigation"
          >
            <Link
              href="/"
              aria-current={path === "/" ? "page" : undefined}
              onClick={close}
            >
              Beranda
            </Link>
            {groups.map((group) => (
              <div
                className="nav-group"
                key={group.label}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    setExpanded("");
                }}
              >
                <button
                  className="nav-trigger"
                  aria-expanded={expanded === group.label}
                  aria-controls={"nav-" + group.label}
                  data-active={group.links.some(
                    ([, href]) =>
                      path === href.split("#")[0] ||
                      path.startsWith(href.split("#")[0] + "/"),
                  )}
                  onClick={() =>
                    setExpanded(expanded === group.label ? "" : group.label)
                  }
                >
                  {group.label}
                  <ChevronDown size={13} />
                </button>
                <div
                  className="nav-dropdown"
                  id={"nav-" + group.label}
                  hidden={expanded !== group.label}
                >
                  {group.links.map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={close}
                      aria-current={path === href ? "page" : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/kontak"
              onClick={close}
              aria-current={path === "/kontak" ? "page" : undefined}
            >
              Kontak
            </Link>
            {state.settings.recruitmentActive && (
              <Link href="/or" className="btn nav-spotlight" onClick={close}>
                <span aria-hidden="true" className="nav-spotlight-dot" />
                Open Recruitment
              </Link>
            )}
            {activeCampaigns(state).length > 0 && (
              <Link
                href="/donasi"
                className="btn nav-spotlight nav-donation"
                onClick={close}
              >
                <span aria-hidden="true" className="nav-spotlight-dot" />
                Donasi
              </Link>
            )}
            {state.events?.some((e) => e.status === "active") && (
              <Link
                href="/event"
                className="btn nav-spotlight nav-event"
                onClick={close}
              >
                Event
              </Link>
            )}
          </nav>
          <div className="header-tools">
            <ThemeButton />
            <button
              className="icon-btn menu-toggle"
              aria-label={open ? "Tutup menu" : "Buka menu"}
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => {
                setOpen(!open);
                setExpanded("");
              }}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  const { settings: s } = useDemo();
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <h2>Salam lestari.</h2>
          <p>
            Wahana Pencinta Alam
            <br />
            Telkom University
          </p>
          <p className="footer-description">
            Merawat ikatan.
            <br />
            Menjaga ruang hidup.
          </p>
        </div>
        <div className="footer-links">
          <h3>Jelajahi</h3>
          <Link href="/profil">Tentang WAPALA</Link>
          <Link href="/galeri">Jejak perjalanan</Link>
          <Link href="/buku">Bahan bacaan</Link>
          <Link href="/peminjaman/status">Lacak pengajuan</Link>
        </div>
        <div>
          <h3>Tetap terhubung</h3>
          <a className="email-link" href={"mailto:" + s.email}>
            {s.email}
          </a>
          <p>{s.address}</p>
          <div className="social-links">
            <a
              href={s.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram WAPALA"
            >
              <Instagram size={20} />
            </a>
            <a
              href={s.youtube}
              target="_blank"
              rel="noreferrer"
              aria-label="YouTube WAPALA"
            >
              <Youtube size={23} />
            </a>
            <a href={s.tiktok} target="_blank" rel="noreferrer">
              TikTok
            </a>
            <a href={"mailto:" + s.email} aria-label="Email WAPALA">
              <Mail size={20} />
            </a>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 WAPALA Telkom University</span>
        <Link href="/privasi">Kebijakan privasi</Link>
      </div>
    </footer>
  );
}
