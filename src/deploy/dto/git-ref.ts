/**
 * A branch, tag or commit sha as the agent passes it to git.
 *
 * Starts with a letter or digit so it can never be read as a git option
 * (`--upload-pack=…`), and rejects `..`, which git refuses in ref names anyway.
 * Mirrored in the agent's own validation.
 */
export const GIT_REF = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/;
