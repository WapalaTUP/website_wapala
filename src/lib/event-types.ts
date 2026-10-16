import { mediaUrlSchema } from "./media-url";
import { z } from "zod";
import { eventFormSchema, type EventAnswers, type EventForm } from "./event-form";
const when = z.union([z.literal(""), z.iso.datetime()]);
const media = z.union([z.literal(""), mediaUrlSchema()]);
export const eventDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000),
    cover: media,
    poster: media,
    location: z.string().max(300),
    eventAt: when,
    start: when,
    end: when,
    quota: z.number().int().min(1).max(1000000).nullable(),
    form: eventFormSchema,
  })
  .strict()
  .superRefine((v, c) => {
    if (v.start && v.end && v.start > v.end)
      c.addIssue({
        code: "custom",
        path: ["end"],
        message: "Tanggal selesai sebelum mulai.",
      });
  });
export type EventDraft = z.infer<typeof eventDraftSchema>;
export type EventStatus = "draft" | "active" | "closed" | "archived";
export type EventAdminDto = {
  id: string;
  version: number;
  status: EventStatus;
  draft: EventDraft;
  publishedRevisionId: string | null;
  registrationCount: number;
};
export type EventPublicDto = EventDraft & {
  id: string;
  revisionId: string;
  status: EventStatus;
  accepting: boolean;
};
export type EventRegistrationDto = {
  id: string;
  code: string;
  createdAt: string;
  revisionId: string;
  revisionNumber: number;
  answers: EventAnswers;
  form: EventForm;
};
export const blankEvent = (): EventDraft => ({
  title: "Event baru",
  description: "",
  cover: "",
  poster: "",
  location: "",
  eventAt: "",
  start: "",
  end: "",
  quota: null,
  form: { title: "Pendaftaran event", description: "", items: [] },
});
