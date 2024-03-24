import { Command } from "./command.mjs";

export default class CompileAppCommand extends Command {
  public static readonly id = "compileApp";

  constructor() {
    super(CompileAppCommand.id);
  }

  async execute(): Promise<void> {}
}
