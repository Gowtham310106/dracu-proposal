import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface SendResult { providerMessageId?: string }

export interface WhatsAppProvider {
  name: string;
  /** `to` is a 10-digit Indian mobile; providers add the 91 prefix. */
  sendText(to: string, body: string): Promise<SendResult>;
}

class ConsoleProvider implements WhatsAppProvider {
  name = 'console';
  async sendText(to: string, body: string): Promise<SendResult> {
    logger.info({ to: `+91${to}`, body }, '[whatsapp:console] message');
    return { providerMessageId: `console-${Date.now()}` };
  }
}

/** WhatsApp Cloud API (Meta). Free-form text only reaches users inside the 24h window; use approved templates in production. */
class MetaCloudProvider implements WhatsAppProvider {
  name = 'meta';
  constructor(private token: string, private phoneId: string) {}
  async sendText(to: string, body: string): Promise<SendResult> {
    const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: `91${to}`, type: 'text', text: { body } }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) throw new Error(json.error?.message ?? `WhatsApp API error ${res.status}`);
    return { providerMessageId: json.messages?.[0]?.id };
  }
}

let provider: WhatsAppProvider | undefined;
export function whatsapp(): WhatsAppProvider {
  if (!provider) {
    if (env.WHATSAPP_PROVIDER === 'meta') {
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID) throw new Error('WHATSAPP_PROVIDER=meta requires WHATSAPP_TOKEN and WHATSAPP_PHONE_ID');
      provider = new MetaCloudProvider(env.WHATSAPP_TOKEN, env.WHATSAPP_PHONE_ID);
    } else {
      provider = new ConsoleProvider();
    }
    logger.info({ provider: provider.name }, 'WhatsApp provider ready');
  }
  return provider;
}
