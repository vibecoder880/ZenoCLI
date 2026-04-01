export async function runAuthCommand(action: string): Promise<void> {
  const normalizedAction = action.trim().toLowerCase();

  switch (normalizedAction) {
    case "status":
      console.log("Authentication management is scheduled for Phase 2.");
      console.log("Phase 1 uses OPENAI_API_KEY from the environment for OpenAI chat.");
      return;
    default:
      console.error(`Auth action "${action}" is not available in Phase 1.`);
      process.exitCode = 1;
  }
}
