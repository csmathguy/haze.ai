import { describe, expect, it } from "vitest";

import { parseGitHubRepositoryFromRemoteUrl } from "./github-cli.js";

describe("parseGitHubRepositoryFromRemoteUrl", () => {
  it("accepts repository names with dots", () => {
    expect(parseGitHubRepositoryFromRemoteUrl("https://github.com/csmathguy/haze.ai.git")).toEqual({
      name: "haze.ai",
      owner: "csmathguy",
      url: "https://github.com/csmathguy/haze.ai"
    });
  });

  it("accepts ssh remotes", () => {
    expect(parseGitHubRepositoryFromRemoteUrl("git@github.com:csmathguy/Haze.ai.git")).toEqual({
      name: "Haze.ai",
      owner: "csmathguy",
      url: "https://github.com/csmathguy/Haze.ai"
    });
  });
});
