import { ForbiddenException } from '@nestjs/common';

export class EventPolicy {
  static assertOwner(organizerId: string, eventOrganizerId: string) {
    if (organizerId !== eventOrganizerId) {
      throw new ForbiddenException('You do not own this event');
    }
  }

  static canTransition(from: string, to: string): boolean {
    const allowed: Record<string, string[]> = {
      DRAFT: ['PREVIEW', 'CANCELLED'],
      PREVIEW: ['PUBLISHED', 'CANCELLED', 'DRAFT'],
      PUBLISHED: ['CANCELLED', 'COMPLETED'],
      CANCELLED: [],
      COMPLETED: [],
    };
    return allowed[from]?.includes(to) ?? false;
  }

  static assertTransition(from: string, to: string) {
    if (!this.canTransition(from, to)) {
      throw new ForbiddenException(`Invalid status transition: ${from} -> ${to}`);
    }
  }
}
