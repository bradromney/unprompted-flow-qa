/**
 * Browser-safe URL path glob matching (no micromatch/picomatch — they touch `process` in the browser).
 * * → single path segment; ** (including normalized trailing `foo*`) → matches across `/`.
 */
function pathGlobToRegExp(patternSansLeadingSlash: string): RegExp {
  let pat = patternSansLeadingSlash;
  if (!pat.includes("/") && pat.endsWith("*") && !pat.endsWith("**")) {
    pat = `${pat.slice(0, -1)}**`;
  } else {
    pat = pat.replace(/(^|\/)\*(?!\*)/g, "$1**");
  }
  let re = "^";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "*" && pat[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (/[.+?^${}()|[\]\\]/.test(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

export function matchStepPath(
  pathname: string,
  urlPattern: string,
  type: "glob" | "regex" = "glob"
): boolean {
  if (type === "regex") {
    try {
      return new RegExp(urlPattern).test(pathname);
    } catch {
      return false;
    }
  }
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const pathSeg = p.slice(1) || "";
  const patSeg = (urlPattern.startsWith("/") ? urlPattern.slice(1) : urlPattern) || "";
  const re = pathGlobToRegExp(patSeg);
  return re.test(pathSeg);
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
