import { memo, useEffect, useMemo, useState } from "react";
import { Player } from "./player";
import {
  useCallAction,
  useCurrentVoiceChannelId,
  useOwnUserRoles,
} from "../store/hooks";

const useControlPermissions = () => {
  const callAction = useCallAction();
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const [permissions, setPermissions] = useState<{
    roleId: number;
    hideButtonWhenNoPermission: boolean;
  }>({
    roleId: -1,
    hideButtonWhenNoPermission: true,
  });

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissions = await callAction("getControlPermissions");

        setPermissions(permissions);
      } catch (error) {
        console.error("Failed to fetch control permissions", error);
      }
    };

    checkPermissions();
  }, [callAction, currentVoiceChannelId]);

  return permissions;
};

const PlayerWrapper = memo(() => {
  const roles = useOwnUserRoles();
  const { roleId, hideButtonWhenNoPermission } = useControlPermissions();
  const currentVoiceChannelId = useCurrentVoiceChannelId();

  const permissions = useMemo(() => {
    const canControl = roles.some((r) => r.id === roleId) || roleId === -1;
    const canView = canControl || !hideButtonWhenNoPermission;

    return { canControl, canView };
  }, [roles, roleId, hideButtonWhenNoPermission]);

  if (!permissions.canView || !currentVoiceChannelId) {
    return null;
  }

  return <Player canControl={permissions.canControl} />;
});

export { PlayerWrapper };
