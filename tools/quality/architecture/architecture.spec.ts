import { describe, expect, it } from "vitest";
import { projectFiles } from "archunit";

const allFiles = projectFiles("./tsconfig.arch.json");
const appFiles = projectFiles("./tsconfig.arch.json").inFolder("apps/**");
const apiFiles = projectFiles("./tsconfig.arch.json").inFolder("apps/**/api/src/**");
const sharedFiles = projectFiles("./tsconfig.arch.json").inFolder("packages/shared/src/**");
const toolFiles = projectFiles("./tsconfig.arch.json").inFolder("tools/**");
const webFiles = projectFiles("./tsconfig.arch.json").inFolder("apps/**/web/src/**");

describe("architecture rules", { timeout: 120_000 }, () => {
  it("prevents frontend code from importing backend implementation details", async () => {
    await expect(webFiles.shouldNot().dependOnFiles().inFolder("apps/**/api/src/**")).toPassAsync();
  });

  it("prevents backend code from importing frontend implementation details", async () => {
    await expect(apiFiles.shouldNot().dependOnFiles().inFolder("apps/**/web/src/**")).toPassAsync();
  });

  it("prevents shared code from depending on app layers", async () => {
    await expect(
      allFiles
        .inFolder("packages/shared/src/**")
        .shouldNot()
        .dependOnFiles()
        .inFolder("apps/**")
    ).toPassAsync();
  });

  it("requires apps to use the shared package public entrypoint", async () => {
    const sharedDeepImportPattern = /["']@taxes\/shared\/[^"']+["']/u;

    await expect(
      apiFiles.should().adhereTo(
        (file) => !sharedDeepImportPattern.test(file.content),
        "App code must import shared code through @taxes/shared instead of deep internal paths."
      )
    ).toPassAsync();
    await expect(
      webFiles.should().adhereTo(
        (file) => !sharedDeepImportPattern.test(file.content),
        "App code must import shared code through @taxes/shared instead of deep internal paths."
      )
    ).toPassAsync();
  });

  it("requires web code to use the public theme entrypoint", async () => {
    const themeTokenImportPattern = /["'][^"']*\/theme\/tokens(?:\.[^"']+)?["']/u;

    await expect(
      webFiles.should().adhereTo(
        (file) => /apps\/[^/]+\/web\/src\/theme\//u.test(file.path) || !themeTokenImportPattern.test(file.content),
        "Web code must import theme concerns through the public theme entrypoint instead of internal token files."
      )
    ).toPassAsync();
  });

  it("keeps production code from depending on test files", async () => {
    await expect(
      appFiles.should().adhereTo(
        (file) => isProductionFile(file.path) ? !importsTestFile(file.content) : true,
        "Production application files must not import test files."
      )
    ).toPassAsync();
    await expect(
      sharedFiles.should().adhereTo(
        (file) => isProductionFile(file.path) ? !importsTestFile(file.content) : true,
        "Production shared files must not import test files."
      )
    ).toPassAsync();
  });

  it("keeps source folders free of circular dependencies", async () => {
    await expect(appFiles.should().haveNoCycles()).toPassAsync();
    await expect(sharedFiles.should().haveNoCycles()).toPassAsync();
    await expect(toolFiles.should().haveNoCycles()).toPassAsync();
  });

  it("keeps TypeScript files below the file-size budget", async () => {
    await expect(
      appFiles.should().adhereTo(
        (file) => file.linesOfCode <= 400,
        "Application files must stay at or below 400 lines of code."
      )
    ).toPassAsync();
    await expect(
      sharedFiles.should().adhereTo(
        (file) => file.linesOfCode <= 400,
        "Shared files must stay at or below 400 lines of code."
      )
    ).toPassAsync();
    await expect(
      toolFiles.should().adhereTo(
        (file) => file.linesOfCode <= 400,
        "Tooling files must stay at or below 400 lines of code."
      )
    ).toPassAsync();
  });
});

function importsTestFile(content: string): boolean {
  return /(?:from|import)\s*(?:\(|)["'][^"']+\.(?:test|spec)\.[^"']+["']/u.test(content);
}

function isProductionFile(filePath: string): boolean {
  return !filePath.endsWith(".test.ts") && !filePath.endsWith(".spec.ts");
}
