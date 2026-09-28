import { validate } from 'class-validator';
import { AdminCreateOrganizerDto } from './admin-create-organizer.dto';
import { UpdateMyOrganizerDto } from './update-my-organizer.dto';

async function errorsOf(dto: object): Promise<string[]> {
  const errors = await validate(dto as any);
  return errors.flatMap((e) => Object.values(e.constraints || {}));
}

describe('Organizer DTO validation (UPI / phone / email)', () => {
  it('should accept a valid organizer payload', async () => {
    const dto = new AdminCreateOrganizerDto();
    dto.name = 'Tech Club';
    dto.email = 'club@example.com';
    dto.phone = '+91 9876543210';
    dto.upiId = 'club@okhdfc';
    dto.description = 'Official club';
    expect(await errorsOf(dto)).toEqual([]);
  });

  it('should reject an invalid UPI ID', async () => {
    const dto = new AdminCreateOrganizerDto();
    dto.name = 'Tech Club';
    dto.email = 'club@example.com';
    dto.upiId = 'not-a-upi';
    const errors = await errorsOf(dto);
    expect(errors.some((m) => m.includes('UPI ID'))).toBe(true);
  });

  it('should reject an invalid phone number', async () => {
    const dto = new AdminCreateOrganizerDto();
    dto.name = 'Tech Club';
    dto.email = 'club@example.com';
    dto.upiId = 'club@upi';
    dto.phone = 'abc';
    const errors = await errorsOf(dto);
    expect(errors.some((m) => m.includes('phone'))).toBe(true);
  });

  it('should reject an invalid email', async () => {
    const dto = new AdminCreateOrganizerDto();
    dto.name = 'Tech Club';
    dto.email = 'not-an-email';
    dto.upiId = 'club@upi';
    expect((await errorsOf(dto)).length).toBeGreaterThan(0);
  });

  it('should validate UPI/phone on self-service update too', async () => {
    const dto = new UpdateMyOrganizerDto();
    dto.upiId = 'bad upi!!';
    dto.phone = '12';
    const errors = await errorsOf(dto);
    expect(errors.some((m) => m.includes('UPI ID'))).toBe(true);
    expect(errors.some((m) => m.includes('phone'))).toBe(true);
  });
});
