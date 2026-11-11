import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type TDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const deferred = <T,>(): TDeferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

type TFakeProcess = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill: ReturnType<typeof mock>;
};

const createFakeProcess = (
  options: { withStdout?: boolean } = {},
): TFakeProcess => ({
  stdout:
    options.withStdout === false ? null : new ReadableStream<Uint8Array>(),
  stderr: null,
  // never exits: a real track keeps the process alive until it ends
  exited: new Promise<number>(() => {}),
  kill: mock(() => {}),
});

type TMetadata = {
  title: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
};

let metadataImpl: (url: string) => Promise<TMetadata>;
let pipeImpl: (url: string) => Promise<TFakeProcess>;
let ytDlpCalls: string[] = [];
let spawnedCommands: unknown[] = [];

const originalSpawn = Bun.spawn;

const baseOptions = (sourceUrl: string) => ({
  sourceUrl,
  audioPayloadType: 111,
  audioSsrc: 1234,
  rtpHost: "127.0.0.1",
  audioRtpPort: 4000,
  log: () => {},
  error: () => {},
  debug: () => {},
});

// ---------------------------------------------------------------------------
// Module mocks: the host SDK and the binaries are unavailable under test
// ---------------------------------------------------------------------------

mock.module("@sharkord/plugin-sdk", () => ({
  Permission: {
    JOIN_VOICE_CHANNELS: "join-voice-channels",
    MANAGE_PLUGINS: "manage-plugins",
  },
  PluginSlot: { TOPBAR_RIGHT: "topbar-right" },
}));

mock.module("../src/server/yt-dlp", () => ({
  isYouTubeUrl: (url: string) =>
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.startsWith("ytsearch:"),
  fetchYouTubeMetadata: (url: string) => {
    ytDlpCalls.push(`metadata:${url}`);

    return metadataImpl(url);
  },
  spawnYouTubeAudioPipe: (url: string) => {
    ytDlpCalls.push(`audio:${url}`);

    return pipeImpl(url);
  },
  logYtDlpLine: () => {},
}));

mock.module("../src/server/downloads", () => ({
  areRequiredBinariesPresent: async () => true,
  downloadBinary: async () => {},
  ensureRequiredBinaries: async () => {},
  isBinaryDownloading: () => false,
}));

const { spawnMusicStream } = await import("../src/server/ffmpeg");
const { clearAllChannelStates } = await import("../src/server/player-state");
const server = await import("../src/server/index");

beforeEach(() => {
  ytDlpCalls = [];
  spawnedCommands = [];
  clearAllChannelStates();

  (Bun as unknown as { spawn: unknown }).spawn = (options: unknown) => {
    spawnedCommands.push(options);

    return createFakeProcess();
  };
});

afterEach(() => {
  (Bun as unknown as { spawn: unknown }).spawn = originalSpawn;
});

// ---------------------------------------------------------------------------
// spawnMusicStream
// ---------------------------------------------------------------------------

describe("spawnMusicStream", () => {
  test("starts the audio pipe without waiting for the metadata", async () => {
    const metadata = deferred<TMetadata>();
    const pipe = deferred<TFakeProcess>();

    metadataImpl = () => metadata.promise;
    pipeImpl = () => pipe.promise;

    const pending = spawnMusicStream(baseOptions("https://youtu.be/abc"));

    // both yt-dlp runs start together, so the slower one is not paid twice
    expect(ytDlpCalls).toEqual([
      "metadata:https://youtu.be/abc",
      "audio:https://youtu.be/abc",
    ]);

    metadata.resolve({ title: "Track", durationSeconds: 42 });
    pipe.resolve(createFakeProcess());

    const result = await pending;

    expect(result.title).toBe("Track");
    expect(result.durationSeconds).toBe(42);
  });

  test("feeds the audio pipe to ffmpeg", async () => {
    metadataImpl = async () => ({ title: "Track" });
    const pipe = createFakeProcess();

    pipeImpl = async () => pipe;

    await spawnMusicStream(baseOptions("https://youtu.be/abc"));

    const spawnOptions = spawnedCommands[0] as { cmd: string[]; stdin: unknown };

    expect(spawnOptions.cmd).toContain("pipe:0");
    expect(spawnOptions.stdin).toBe(pipe.stdout);
  });

  test("kills the audio pipe when the metadata fails", async () => {
    const metadata = deferred<TMetadata>();
    const pipe = createFakeProcess();

    metadataImpl = () => metadata.promise;
    pipeImpl = async () => pipe;

    const pending = spawnMusicStream(baseOptions("https://youtu.be/abc"));

    metadata.reject(new Error("metadata exploded"));

    await expect(pending).rejects.toThrow("metadata exploded");
    expect(pipe.kill).toHaveBeenCalledWith("SIGTERM");
  });

  test("rejects when the audio pipe has no stdout", async () => {
    const pipe = createFakeProcess({ withStdout: false });

    metadataImpl = async () => ({ title: "Track" });
    pipeImpl = async () => pipe;

    await expect(
      spawnMusicStream(baseOptions("https://youtu.be/abc")),
    ).rejects.toThrow("yt-dlp pipe is not available");
    expect(pipe.kill).toHaveBeenCalledWith("SIGTERM");
  });

  test("sends non-YouTube sources straight to ffmpeg", async () => {
    const result = await spawnMusicStream(
      baseOptions("https://example.com/track.mp3"),
    );

    expect(ytDlpCalls).toEqual([]);
    expect(result.title).toBe("https://example.com/track.mp3");
    expect((spawnedCommands[0] as { cmd: string[] }).cmd).toContain(
      "https://example.com/track.mp3",
    );
  });
});

// ---------------------------------------------------------------------------
// playMusic action
// ---------------------------------------------------------------------------

type TAction = {
  name: string;
  executes: (invoker: unknown, payload: unknown) => Promise<unknown>;
};

type TPush = {
  channelId: number;
  player: { streamActive: boolean; streamStarting: boolean; currentSong: string | null };
};

const createContext = () => {
  const actions = new Map<string, TAction>();
  const pushes: TPush[] = [];
  const producer = {
    observer: { on: mock(() => {}), off: mock(() => {}) },
    close: mock(() => {}),
  };

  const ctx = {
    dataPath: "/tmp/opencode/music-bot-test",
    logger: { log: () => {}, error: () => {}, debug: () => {} },
    push: { toAll: (payload: TPush) => pushes.push(payload) },
    voice: {
      getRouter: () => ({
        on: mock(() => {}),
        off: mock(() => {}),
        createPlainTransport: async () => ({
          produce: async () => producer,
          tuple: { localPort: 41234 },
          close: mock(() => {}),
        }),
      }),
      getListenInfo: () => ({ announcedAddress: "127.0.0.1", ip: "127.0.0.1" }),
      createStream: () => ({ remove: mock(() => {}) }),
    },
    settings: {
      register: async () => ({
        get: (key: string) => (key === "bitrate" ? "128k" : ""),
      }),
    },
    ui: { enable: () => {} },
    events: { on: () => {} },
    actions: { register: (action: TAction) => actions.set(action.name, action) },
    commands: { register: () => {} },
  };

  return { actions, ctx, pushes };
};

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("playMusic", () => {
  test("announces the starting state before the source resolves", async () => {
    const { actions, ctx, pushes } = createContext();

    await server.onLoad(ctx as never);

    const metadata = deferred<TMetadata>();
    const pipe = deferred<TFakeProcess>();

    metadataImpl = () => metadata.promise;
    pipeImpl = () => pipe.promise;

    const play = actions.get("playMusic");

    if (!play) throw new Error("playMusic was not registered");

    const pending = play.executes(
      { currentVoiceChannelId: 55, userId: 7 },
      { query: "https://youtu.be/abc" },
    );

    await settle();

    const startingPush = pushes.find(
      (push) =>
        push.channelId === 55 &&
        push.player.streamStarting &&
        !push.player.streamActive,
    );

    expect(startingPush).toBeDefined();

    metadata.resolve({ title: "Song", durationSeconds: 100 });
    pipe.resolve(createFakeProcess());

    await expect(pending).resolves.toMatchObject({
      message: "Now playing: Song",
    });

    const lastPush = pushes.at(-1);

    expect(lastPush?.player).toMatchObject({
      streamActive: true,
      streamStarting: false,
      currentSong: "Song",
    });
  });

  test("clears the starting state when the source fails", async () => {
    const { actions, ctx, pushes } = createContext();

    await server.onLoad(ctx as never);

    const metadata = deferred<TMetadata>();
    const pipe = createFakeProcess();

    metadataImpl = () => metadata.promise;
    pipeImpl = async () => pipe;

    const play = actions.get("playMusic");

    if (!play) throw new Error("playMusic was not registered");

    const pending = play.executes(
      { currentVoiceChannelId: 56, userId: 7 },
      { query: "https://youtu.be/abc" },
    );

    await settle();
    metadata.reject(new Error("extract failed"));

    await expect(pending).rejects.toThrow("extract failed");

    const lastPush = pushes.at(-1);

    expect(lastPush?.player).toMatchObject({
      streamActive: false,
      streamStarting: false,
    });
  });
});
