export type AuthenticatedUser = Readonly<{
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  isAdmin: boolean;
}>;
