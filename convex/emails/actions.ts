"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { Resend } from "resend";
import { renderEmail } from "./templates";

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error("RESEND_API_KEY environment variable not set");
    }
    return new Resend(apiKey);
}

const FROM_EMAIL = "onboarding@resend.dev";

export const internalSendEmail = internalAction({
    args: {
        to: v.string(),
        subject: v.string(),
        html: v.string(),
    },
    handler: async (_, args) => {
        const resend = getResendClient();

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: args.to,
            subject: args.subject,
            html: args.html,
        });

        if (error) {
            console.error("Failed to send email:", error);
            throw new Error(`Email send failed: ${error.message}`);
        }

        console.log("Email sent successfully:", data?.id);
        return { success: true, messageId: data?.id };
    },
});

export const sendTestEmail = action({
    args: {
        to: v.optional(v.string()),
    },
    handler: async (_, args) => {
        const resend = getResendClient();
        const to = args.to ?? "baldai@hey.com";

        const { subject, html } = renderEmail("test", { recipientName: "Michal" });

        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
        });

        if (error) {
            console.error("Failed to send test email:", error);
            throw new Error(`Test email send failed: ${error.message}`);
        }

        console.log("Test email sent successfully:", data?.id);
        return { success: true, messageId: data?.id, sentTo: to };
    },
});
