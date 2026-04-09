import micromatch from "micromatch";

function normalizeGlob(pattern: string): string {
  const pat = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  if (!pat.includes("/") && pat.endsWith("*") && !pat.endsWith("**")) {
    return `${pat.slice(0, -1)}**`;
  }
  return pat.replace(/(^|\/)\*(?!\*)/g, "**");
}

export function matchStepPath(
  pathname: string,
  urlPattern: string,
  type: "glob" | "regex" = "glob"
): boolean {
  if (type === "regex") {
    try {
      const re = new RegExp(urlPattern);
      return re.test(pathname);
    } catch {
      return false;
    }
  }
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathSeg = p.slice(1) || "";
  const patSeg = (urlPattern.startsWith("/") ? urlPattern.slice(1) : urlPattern) || "";
  const mmPat = normalizeGlob(patSeg);
  return micromatch.isMatch(pathSeg, mmPat, { dot: true });
}

export function findMatchingStepIds(
  pathname: string,
  steps: Record<string, { urlPattern: string; type?: "glob" | "regex" }>
): string[] {
  const ids: string[] = [];
  for (const [id, step] of Object.entries(steps)) {
    const t = step.type ?? "glob";
    if (matchStepPath(pathname, step.urlPattern, t)) ids.push(id);
  }
  return ids;
}
