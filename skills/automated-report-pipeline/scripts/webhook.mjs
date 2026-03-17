#!/usr/bin/env node
/**
 * webhook.mjs - Multi-platform webhook delivery helper
 */

export async function webhookDeliver(config, content, format, platform) {
  const fetch = (await import('node-fetch')).default;
  
  if (!config?.webhookUrl && !config?.token) {
    console.warn(`⚠️ ${platform}: No webhook configured`);
    return;
  }

  let body;
  let headers = { 'Content-Type': 'application/json' };

  switch (platform) {
    case 'discord':
      body = {
        content: format === 'json' ? '```json\n' + content.substring(0, 1800) + '\n```' : content.substring(0, 1900),
        username: 'OpenClaw Reporter',
        avatar_url: 'https://openclaw.ai/logo.png'
      };
      break;
    
    case 'slack':
      body = {
        text: format === 'json' ? '```' + content.substring(0, 1800) + '```' : content,
        username: 'OpenClaw Reporter',
        icon_emoji: ':robot_face:'
      };
      break;
    
    case 'telegram':
      if (!config.token || !config.chatId) {
        console.warn('⚠️ Telegram: Missing token or chatId');
        return;
      }
      const apiUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: `📊 *Report Generated*\n\n${content.substring(0, 3500)}`,
          parse_mode: 'Markdown'
        })
      });
      return await response.json();
    
    default:
      console.warn(`⚠️ Unknown platform: ${platform}`);
      return;
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`${platform} webhook failed: ${response.statusText}`);
    }
    
    console.log(`✅ ${platform} delivery success`);
    return await response.json();
  } catch (e) {
    console.error(`❌ ${platform} delivery failed: ${e.message}`);
    throw e;
  }
}
