import "dotenv/config";
import { getDb } from "../src/server/db";
// Prune berkala data keamanan/sesi yang kedaluwarsa. Berdiri sendiri —
// TIDAK bergantung pada EMAIL_MODE (cleanup lama tergantung worker email
// dan tidak pernah jalan pada mode disabled).
async function main() {
  const db = getDb(),
    now = new Date(),
    dayAgo = new Date(now.getTime() - 86400000),
    weekAgo = new Date(now.getTime() - 7 * 86400000);
  const throttle = await db.securityThrottle.deleteMany({
    where: { expiresAt: { lt: dayAgo } },
  });
  const sessions = await db.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: weekAgo } }] },
  });
  const resetTokens = await db.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: dayAgo } }] },
  });
  const outbox = await db.emailOutbox.updateMany({
    where: { payload: { not: null }, expiresAt: { lte: now } },
    data: { payload: null, lastError: "EXPIRED" },
  });
  console.log(
    JSON.stringify({
      event: "maintenance_prune",
      securityThrottle: throttle.count,
      sessions: sessions.count,
      passwordResetTokens: resetTokens.count,
      outboxExpired: outbox.count,
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(
      JSON.stringify({
        event: "maintenance_prune_failed",
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    process.exit(1);
  });
