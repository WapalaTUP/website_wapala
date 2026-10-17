import { Fragment, type ReactNode } from "react";
import { articleVideoEmbed, parseArticleBlocks, safeArticleLink } from "@/lib/article-content";
import styles from "./articles.module.css";

/** A deliberately small formatting grammar, rendered as React text rather than HTML. */
export function ArticleInline({ text }: { text: string }) {
  const chunks: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^\s)]+)\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    chunks.push(text.slice(cursor, match.index));
    const href = match[5] ? safeArticleLink(match[5]) : null;
    chunks.push(
      <Fragment key={match.index}>
        {match[2] ? (
          <strong>{match[2]}</strong>
        ) : match[3] ? (
          <em>{match[3]}</em>
        ) : href ? (
          <a href={href} rel="noopener noreferrer">
            {match[4]}
          </a>
        ) : (
          match[4]
        )}
      </Fragment>,
    );
    cursor = match.index! + match[0].length;
  }
  chunks.push(text.slice(cursor));
  return chunks;
}

export function ArticleBody({ fields }: { fields: Record<string, unknown> }) {
  return (
    <div className={styles.body}>
      {parseArticleBlocks(fields).map((block) => {
        const text = <ArticleInline text={block.text || ""} />;
        if (block.type === "heading") return <h2 key={block.id}>{text}</h2>;
        if (block.type === "quote") return <blockquote key={block.id}>{text}</blockquote>;
        if (block.type === "list")
          return (
            <ul key={block.id}>
              {String(block.text || "")
                .split("\n")
                .filter(Boolean)
                .map((item, i) => (
                  <li key={i}>
                    <ArticleInline text={item} />
                  </li>
                ))}
            </ul>
          );
        if (block.type === "image" || block.type === "video") {
          const embed = block.type === "video" ? articleVideoEmbed(block.src || "") : null;
          return (
            <figure key={block.id} className={styles.figure}>
              {block.type === "image" ? (
                <img src={block.src} alt={block.alt || ""} loading="lazy" />
              ) : embed ? (
                <iframe
                  className={
                    embed.includes("instagram.com") || embed.includes("tiktok.com")
                      ? styles.portraitEmbed
                      : undefined
                  }
                  src={embed}
                  title={block.caption || "Video artikel"}
                  loading="lazy"
                  allow="encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              ) : (
                <video src={block.src} controls preload="metadata" playsInline />
              )}
              {(block.caption || block.credit) && (
                <figcaption>
                  {block.caption}
                  {block.credit && <span className={styles.credit}>{block.credit}</span>}
                </figcaption>
              )}
            </figure>
          );
        }
        return <p key={block.id}>{text}</p>;
      })}
    </div>
  );
}
