/**
 * Notification helper — V11.11
 *
 * In-app értesítések létrehozása + opcionális email-küldés. Az email-rész
 * jelenleg placeholder: ha `SMTP_HOST` env be van állítva, a `sendEmail` egy
 * jövőbeli implementáció helye; addig a függvény logol, ami auditálható.
 *
 * Fire-and-forget: hibák csak warnként logolódnak, sosem dobnak fel.
 */

import { getDb } from "./db";
import { notifications } from "../drizzle/schema";

export interface CreateNotificationInput {
  userId: number;
  eventType: string;
  title: string;
  body?: string;
  link?: string;
  email?: string; // recipient email — needed for the SMTP path
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(notifications).values({
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
    // Fire-and-forget email path.
    if (input.email) {
      void sendEmail({
        to: input.email,
        subject: `[Compliance Checker] ${input.title}`,
        body: input.body ?? input.title,
        link: input.link,
      }).catch((err) => {
        console.warn("[notifications.sendEmail] failed:", err);
      });
    }
  } catch (err) {
    console.warn("[notifications.create] error:", err);
  }
}

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  link?: string;
}

/**
 * Placeholder email-sender. Ha a `SMTP_HOST` env változó be van állítva, itt
 * lehet bekötni egy valódi SMTP-klienst (nodemailer, Resend stb.). Addig
 * csak naplózunk — az audit-naplóból úgyis látszik, hogy értesítés keletkezett.
 */
async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!process.env.SMTP_HOST) {
    // SMTP nincs konfigurálva — csak in-app marad.
    return;
  }
  // TODO: itt lehet bekötni a valódi SMTP-klienst. A pilot-időszakra üresen
  // hagyjuk; az `emailSentAt` mező a notifications táblában csak akkor lesz
  // beállítva, amikor egy konkrét implementáció oda ír.
  console.info("[notifications.sendEmail] would send:", payload.to, payload.subject);
}
