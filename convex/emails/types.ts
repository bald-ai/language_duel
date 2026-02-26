export type EmailTemplateId = "test" | "duel_result";

export type EmailMessage = {
    to: string;
    subject: string;
    html: string;
};
