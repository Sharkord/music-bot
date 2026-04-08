type Commands = {
  play: {
    args: { query: string };
    response: string;
  };
  play_direct: {
    args: { url: string };
    response: string;
  };
  music_clean: {
    args: {};
    response: unknown;
  };
  stop: {
    args: undefined;
    response: void;
  };
  volume: {
    args: { volume: number };
    response: string;
  };
  now_playing: {
    args: undefined;
    response: string;
  };
  next: {
    args: undefined;
    response: string;
  };
  clear_queue: {
    args: undefined;
    response: string;
  };
  queue: {
    args: undefined;
    response: string;
  };
};

export type { Commands };
