import {
  PluginSlot,
  type TPluginComponentsMapBySlotId,
} from "@sharkord/plugin-sdk";
import { Player } from "./components/player";
import { PlayerWrapper } from "./components/player-wrapper";

const components: TPluginComponentsMapBySlotId = {
  [PluginSlot.TOPBAR_RIGHT]: [PlayerWrapper],
};

export { components };
