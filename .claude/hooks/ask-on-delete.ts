// PreToolUse hook: force a confirmation prompt before any deletion command
// (rm / rmdir / unlink / del / Remove-Item) run through the Bash or
// PowerShell tools. Inspects the actual command text, so it also catches
// deletes buried in a compound command (`cd x && rm y`) and PowerShell's
// `rm` alias — things a plain `Bash(rm:*)` permission rule would miss.
//
// Reads the tool-call JSON on stdin; prints an "ask" decision only when a
// delete is detected, and stays silent (normal permission flow) otherwise.
const input = await Bun.stdin.text();

let command = "";
try {
  command = JSON.parse(input)?.tool_input?.command ?? "";
} catch {
  process.exit(0); // Not JSON we understand — don't interfere.
}

// The verb must sit at a command boundary (start, whitespace, or ; & |) so
// `docker run --rm`, `warm`, and `format` don't trip it, while `git rm foo`
// and `cd a && Remove-Item b` do.
const DELETE = /(^|[;&|]|\s)(rm|rmdir|unlink|del|Remove-Item)(\s|$)/i;

if (DELETE.test(command)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "Deletion command detected — confirm before running.",
      },
    }),
  );
}
