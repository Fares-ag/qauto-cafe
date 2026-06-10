export const WS_CLIENT_EVENTS = {
  SUBSCRIBE: 'subscribe',
  PING: 'ping',
  RESYNC: 'resync',
} as const;

export const WS_SERVER_EVENTS = {
  ORDER_QUEUE_SNAPSHOT: 'order.queue_snapshot',
  PONG: 'pong',
} as const;
