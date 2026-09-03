import {
  PluginSlot,
  type TPluginComponentsMapBySlotId,
} from "@sharkord/plugin-sdk";
import { Player } from "./player";

const components: TPluginComponentsMapBySlotId = {
  [PluginSlot.TOPBAR_RIGHT]: [Player],
};

export { components };
