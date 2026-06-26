import type { StatusResponse } from '../types';

export function companionUrl(status: Pick<StatusResponse, 'lanUrls' | 'currentOrigin'>) {
  if (import.meta.env.DEV && location.port) {
    const lan = status.lanUrls[0];
    if (lan) {
      const url = new URL(lan);
      url.port = location.port;
      return url.toString().replace(/\/$/, '');
    }
    return location.origin;
  }

  return (status.lanUrls[0] || status.currentOrigin || location.origin).replace(/\/$/, '');
}
