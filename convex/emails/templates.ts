import type { EmailTemplateId, EmailMessage } from "./types";

type TestTemplateProps = {
    recipientName: string;
};

type DuelResultTemplateProps = {
    recipientName: string;
    opponentName: string;
    didWin: boolean;
    score: string;
};

type TemplateProps = {
    test: TestTemplateProps;
    duel_result: DuelResultTemplateProps;
};

export function renderEmail<T extends EmailTemplateId>(
    templateId: T,
    props: TemplateProps[T]
): Omit<EmailMessage, "to"> {
    switch (templateId) {
        case "test":
            return renderTestEmail(props as TestTemplateProps);
        case "duel_result":
            return renderDuelResultEmail(props as DuelResultTemplateProps);
        default:
            throw new Error(`Unknown template: ${templateId}`);
    }
}

function renderTestEmail(props: TestTemplateProps): Omit<EmailMessage, "to"> {
    return {
        subject: "Test Email from Language Duel",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Hi ${props.recipientName},</h1>
                <p>This is a test email from Language Duel.</p>
                <p>If you're seeing this, the email system is working correctly!</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px;">Language Duel Team</p>
            </div>
        `,
    };
}

function renderDuelResultEmail(props: DuelResultTemplateProps): Omit<EmailMessage, "to"> {
    const resultText = props.didWin
        ? `Congratulations! You won against ${props.opponentName}!`
        : `You lost to ${props.opponentName}. Better luck next time!`;

    return {
        subject: props.didWin ? "You won your duel!" : "Duel Result",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Hi ${props.recipientName},</h1>
                <p>${resultText}</p>
                <p><strong>Final Score:</strong> ${props.score}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px;">Language Duel Team</p>
            </div>
        `,
    };
}
