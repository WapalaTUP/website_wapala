"use client";
import Image from "next/image";
import Link from "next/link";
import { useDemo } from "@/lib/store";
import { activeCampaigns, campaignTotal } from "@/lib/campaigns";
import { money } from "@/lib/content";
import { PageIntro } from "./page-intro";
import { Empty } from "./ui";
import { DonationForm } from "./forms";
export function CampaignPages({ id }: { id?: string }) {
  const state = useDemo(),
    list = activeCampaigns(state);
  if (id) return <DonationForm key={id} campaignId={id} />;
  return (
    <>
      <PageIntro
        title="Ruang kepedulian bersama."
        description="Pilih kampanye yang ingin kamu dukung. Setiap tujuan memiliki pengelolaan dan verifikasi tersendiri."
      />
      <section className="container section campaign-public-list">
        {list.length ? (
          list.map((c) => (
            <article key={c.id} className="campaign-public-card">
              {c.cover && (
                <Image src={c.cover} width={640} height={360} alt={c.title} unoptimized />
              )}
              <h2>{c.title}</h2>
              <p>{c.description}</p>
              <p>
                {money(campaignTotal(state.donations, c.id))} terverifikasi dari {money(c.target)}
              </p>
              <Link href={"/donasi/" + c.id} className="btn primary">
                Lihat kampanye
              </Link>
            </article>
          ))
        ) : (
          <Empty
            title="Belum ada kampanye aktif"
            description="Kampanye akan tampil setelah dibuka oleh admin."
          />
        )}
      </section>
    </>
  );
}
