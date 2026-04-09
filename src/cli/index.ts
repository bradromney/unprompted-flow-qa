import { Command } from "commander";
import { resolve } from "node:path";
import { runGenerate } from "./generate";
import { runGitContext } from "./git-context";

const program = new Command();

program.name("flow-qa").description("Unprompted Flow QA CLI");

program
  .command("generate")
  .description("Generate flow JSON + strategic observations via LLM (or stub)")
  .option("--cwd <dir>", "project root", process.cwd())
  .option("--out <dir>", "output directory under cwd", "public/flow-qa")
  .option("--routes <file>", "path to routes.json relative to cwd")
  .option("--model <id>", "OpenAI model", process.env.FLOW_QA_MODEL ?? "gpt-4o-mini")
  .action(async (opts) => {
    await runGenerate({
      cwd: resolve(opts.cwd),
      outDir: opts.out,
      routesFile: opts.routes,
      openaiModel: opts.model,
    });
  });

program
  .command("git-context")
  .description("Write git diff file list for the dev UI")
  .option("--cwd <dir>", "project root", process.cwd())
  .option("--base <branch>", "git base", "main")
  .option("--out <file>", "output json relative to cwd", "public/flow-qa/git-context.json")
  .option("--mirror <file>", "optional second copy (e.g. flow-qa/git-context.json)", "")
  .action((opts) => {
    runGitContext({
      cwd: resolve(opts.cwd),
      base: opts.base,
      outFile: opts.out,
      publicCopy: opts.mirror || undefined,
    });
    console.log(`Wrote git context → ${opts.out}`);
  });

program.parse();
