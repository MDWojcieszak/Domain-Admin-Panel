export type Session = {
  id: string;
  userId: string;
  refreshToken: string;

  os?: string;
  platform?: string;
  browser?: string;
};
