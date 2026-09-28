import { OrganizersRepository } from './organizers.repo';
import { OrganizerStatus } from '@prisma/client';

// Verifies the deactivation/reactivation cascade at the repository level:
// organizer status + login flag + ALL organizer events must change together.
describe('OrganizersRepository - activation cascade', () => {
  const calls: { organizerUpdate: any[]; userUpdate: any[]; eventUpdateMany: any[] } = { organizerUpdate: [], userUpdate: [], eventUpdateMany: [] };
  const mockPrisma: any = {
    organizer: {
      update: jest.fn((args: any) => {
        calls.organizerUpdate.push(args);
        return Promise.resolve({ id: 'o1', ...args.data });
      }),
    },
    user: {
      update: jest.fn((args: any) => {
        calls.userUpdate.push(args);
        return Promise.resolve({ id: 'u1', ...args.data });
      }),
    },
    event: {
      updateMany: jest.fn((args: any) => {
        calls.eventUpdateMany.push(args);
        return Promise.resolve({ count: 2 });
      }),
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  beforeEach(() => {
    calls.organizerUpdate.length = 0;
    calls.userUpdate.length = 0;
    calls.eventUpdateMany.length = 0;
    jest.clearAllMocks();
  });

  it('deactivateTransaction disables organizer, user login AND all events', async () => {
    const repo = new OrganizersRepository(mockPrisma);
    await repo.deactivateTransaction('o1', 'u1');
    expect(calls.organizerUpdate[0]).toEqual(
      expect.objectContaining({ where: { id: 'o1' }, data: expect.objectContaining({ status: OrganizerStatus.REJECTED, isActive: false }) }),
    );
    expect(calls.userUpdate[0]).toEqual(
      expect.objectContaining({ where: { id: 'u1' }, data: { isActive: false } }),
    );
    expect(calls.eventUpdateMany[0]).toEqual(
      expect.objectContaining({ where: { organizerId: 'o1' }, data: { isActive: false } }),
    );
  });

  it('reactivateTransaction restores organizer, user login AND all events', async () => {
    const repo = new OrganizersRepository(mockPrisma);
    await repo.reactivateTransaction('o1', 'u1');
    expect(calls.organizerUpdate[0]).toEqual(
      expect.objectContaining({ where: { id: 'o1' }, data: expect.objectContaining({ status: OrganizerStatus.APPROVED, isActive: true }) }),
    );
    expect(calls.userUpdate[0]).toEqual(
      expect.objectContaining({ where: { id: 'u1' }, data: { isActive: true } }),
    );
    expect(calls.eventUpdateMany[0]).toEqual(
      expect.objectContaining({ where: { organizerId: 'o1' }, data: { isActive: true } }),
    );
  });
});
