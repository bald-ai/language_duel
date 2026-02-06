export type SendEmailResult = {
  success: boolean;
  sentTo: string;
  messageId?: string;
};

export function formatEmailSuccessOutput(result: SendEmailResult): string[] {
  return [
    "",
    "✅ Email sent successfully!",
    `   To: ${result.sentTo}`,
    `   Message ID: ${result.messageId}`,
  ];
}

export function formatEmailErrorOutput(message: string): string {
  return `\n❌ Failed to send email: ${message}`;
}

export function parseEmailArg(arg: string | undefined): string | undefined {
  if (!arg || arg.trim() === "") {
    return undefined;
  }
  return arg.trim();
}

export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}