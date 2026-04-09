import { useMemo } from "react";
import { createCallAction } from "@sharkord/plugin-sdk";
import { actions, useStoreSelector } from ".";
import {
  currentVoiceChannelIdSelector,
  ownUserRolesSelector,
  userByIdSelector,
} from "./selectors";
import type { Actions } from "../../contracts/actions";

export const useCallAction = () =>
  useMemo(() => createCallAction<Actions>(actions), []);

export const useCurrentVoiceChannelId = () =>
  useStoreSelector(currentVoiceChannelIdSelector);

export const useOwnUserRoles = () => useStoreSelector(ownUserRolesSelector);

export const useUserById = (userId: number) =>
  useStoreSelector((state) => userByIdSelector(state, userId));
