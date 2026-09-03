import {
  createCallAction,
  useStoreSelector,
  type TPluginStoreState,
} from "@sharkord/plugin-sdk/client";
import type { TSharkord } from "../contract";

const callAction = createCallAction<TSharkord>();

const useCurrentVoiceChannelId = () =>
  useStoreSelector((state: TPluginStoreState) => state.currentVoiceChannelId);

const useUserName = (userId: number | null): string | undefined => {
  const users = useStoreSelector((state: TPluginStoreState) => state.users);

  if (userId === null) return undefined;

  return users.find((user) => user.id === userId)?.name;
};

export { callAction, useCurrentVoiceChannelId, useUserName };
