import { v } from "convex/values";

export type EmailTemplateId = "test" | "duel_result";

export type EmailMessage = {
    to: string;
    subject: string;
    html: string;
};

export const emailTemplateIdValidator = v.union(
    v.literal("test"),
    v.literal("duel_result")
);
