/**
 * ESM hooks: resolves *.js imports to *.ts when the .ts file exists.
 * Registration: import this file via --import to register as a hook.
 *   node --import ./ts-resolver.mjs --experimental-strip-types --test ...
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(new URL(import.meta.url).pathname).href, import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".js")) {
    // Try remapping to .ts
    try {
      const tsSpec = specifier.slice(0, -3) + ".ts";
      return await nextResolve(tsSpec, context);
    } catch {
      // fall through to .js
    }
  }
  return nextResolve(specifier, context);
}

