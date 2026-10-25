/**
 * A public project link's live session (docs/projects-design.md D11). Signed
 * with its own secret, so it can never pass as an account's access token: the
 * HTTP guard verifies with JWT_SECRET and rejects it.
 */
export interface ShareSessionPayload {
  kind: 'project-share';
  linkId: string;
  projectId: string;
}

export const shareSessionSecret = (jwtSecret: string) =>
  `${jwtSecret}:project-share`;

/** Where a project's link holders hear about changes. */
export const projectShareRoom = (projectId: string) =>
  `project-share:${projectId}`;

/** One link's sockets, so revoking it can drop them at once. */
export const shareLinkRoom = (linkId: string) => `share-link:${linkId}`;
