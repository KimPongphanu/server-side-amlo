import { translate } from '@vitalets/google-translate-api';

/**
 * Translates a given text from Thai to English.
 * Fallback to the original text if translation fails.
 * 
 * @param text The original text to translate
 * @returns The translated text or the original text if it fails
 */
export const translateToEnglish = async (text: string | null | undefined): Promise<string | null> => {
  if (!text || text.trim() === '') {
    return text || null;
  }

  try {
    const res = await translate(text, { to: 'en' });
    return res.text;
  } catch (error: any) {
    console.error(`[Translate Error]: Failed to translate text: "${text.substring(0, 30)}..."`, error.message);
    // Fallback: return the original text
    return text;
  }
};
