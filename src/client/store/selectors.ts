import { createSelector } from "reselect";
import type { SharkordState } from ".";
import { createCachedSelector } from "re-reselect";

export const currentVoiceChannelIdSelector = (state: SharkordState) =>
  state.currentVoiceChannelId;

export const ownUserIdSelector = (state: SharkordState) => state.ownUserId;

export const rolesSelector = (state: SharkordState) => state.roles;

export const usersSelector = (state: SharkordState) => state.users;

export const ownUserRolesSelector = createSelector(
  [rolesSelector, ownUserIdSelector, usersSelector],
  (roles, ownUserId, users) => {
    const user = users.find((u) => u.id === ownUserId);

    if (!user?.roleIds) return [];

    return roles.filter((role) => user.roleIds.includes(role.id));
  },
);

export const userByIdSelector = createCachedSelector(
  usersSelector,
  (_: SharkordState, userId: number) => userId,
  (users, userId) => users.find((u) => u.id === userId),
)((_, userId) => userId);
