import { useEffect } from 'react';
import { VSCodeMessage } from '../types';

export function useVSCodeMessage(callback: (message: VSCodeMessage) => void) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message && typeof message === 'object' && message.command) {
        callback(message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [callback]);
} 