import { specialistTools } from "../src/data/specialist-tools";

async function main() {
  const failures: string[] = [];

  await Promise.all(
    specialistTools.map(async (tool) => {
      try {
        const response = await fetch(tool.url, {
          redirect: "follow",
          headers: { "User-Agent": "MichiganOutdoorsNow-LinkCheck/1.0" },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) failures.push(`${tool.name}: ${response.status} ${tool.url}`);
      } catch (error) {
        failures.push(`${tool.name}: ${error instanceof Error ? error.message : "request failed"} ${tool.url}`);
      }
    }),
  );

  if (failures.length) {
    console.error("Specialist link check failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Specialist link check passed: ${specialistTools.length} verified live destinations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
