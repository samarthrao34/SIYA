import type { LiveServerMessage } from '@google/genai';

/** Control packets and empty model turns contain no playable audio. */
export function readLiveAudio(message: LiveServerMessage): string | undefined {
  return message.serverContent?.modelTurn?.parts?.find((part) =>
    part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith('audio/'))
  )?.inlineData?.data;
}
