import { Command } from "./command.mjs";

export default class SwitchSDKCommand extends Command {
  public static readonly id = "switchSDK";

  constructor() {
    super(SwitchSDKCommand.id);
  }

  async execute(): Promise<void> {}
}
