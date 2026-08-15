import type { AuthenticatedUser } from '$lib/types/auth';

declare global {
  namespace App {
    interface Locals {
      requestId: string;
      user: AuthenticatedUser | null;
    }
  }
}

export {};
