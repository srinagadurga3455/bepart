import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Pravesh database...');

  // Admin bootstrap — ADMIN never via public signup, only via seed
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pravesh.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const hashed = await bcrypt.hash(adminPassword, 10);

  // 1) User with role ADMIN and isActive true — idempotent via email unique
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Pravesh Admin',
      role: Role.ADMIN,
      isActive: true,
      password: hashed,
    },
    create: {
      email: adminEmail,
      password: hashed,
      name: 'Pravesh Admin',
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`Admin user: ${adminUser.email} (${adminUser.id}) role=${adminUser.role} isActive=${adminUser.isActive}`);

  // 2) Admin profile with status ACTIVE — idempotent via id = adminUser.id (1-1)
  const admin = await prisma.admin.upsert({
    where: { id: adminUser.id },
    update: {
      companyName: 'Pravesh',
      description: 'Platform Admin',
      status: 'ACTIVE',
    },
    create: {
      id: adminUser.id,
      companyName: 'Pravesh',
      description: 'Platform Admin',
      status: 'ACTIVE',
    },
  });
  console.log(`Admin profile: ${admin.companyName} (${admin.id}) status=${admin.status}`);

  const organizerUser = await prisma.user.upsert({
    where: { email: 'organizer@pravesh.local' },
    update: {
      isActive: true,
      name: 'Sample Club Organizer',
      role: Role.ORGANIZER,
      phone: '+91 9876543210',
      password: await bcrypt.hash('Organizer@123', 10),
    },
    create: {
      email: 'organizer@pravesh.local',
      password: await bcrypt.hash('Organizer@123', 10),
      name: 'Sample Club Organizer',
      role: Role.ORGANIZER,
      phone: '+91 9876543210',
    },
  });

  await prisma.organizer.upsert({
    where: { userId: organizerUser.id },
    update: {
      name: 'Sample Tech Club',
      description: 'Seeded organizer for development',
      email: 'organizer@pravesh.local',
      phone: '+91 9876543210',
      upiId: 'sample@upi',
      status: 'APPROVED',
      adminId: admin.id,
    },
    create: {
      userId: organizerUser.id,
      adminId: admin.id,
      name: 'Sample Tech Club',
      description: 'Seeded organizer for development',
      email: 'organizer@pravesh.local',
      phone: '+91 9876543210',
      upiId: 'sample@upi',
      status: 'APPROVED',
    },
  });

  await prisma.user.upsert({
    where: { email: 'student@pravesh.local' },
    update: {},
    create: {
      email: 'student@pravesh.local',
      password: await bcrypt.hash('Student@123', 10),
      name: 'Sample Student',
      role: Role.STUDENT,
      phone: '+91 9999999999',
    },
  });

  const organizer = await prisma.organizer.findUnique({ where: { userId: organizerUser.id } });
  if (organizer) {
    const existingEvent = await prisma.event.findFirst({ where: { organizerId: organizer.id } });
    if (!existingEvent) {
      await prisma.event.create({
        data: {
          eventName: 'Sample Tech Fest',
          description: 'Seeded event with Google Form style registration',
          date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          slots: 100,
          closingTime: new Date(Date.now() + 6 * 24 * 3600 * 1000),
          status: 'PUBLISHED',
          formStructure: {
            title: 'TechFest 2026 Registration',
            description: 'Register for TechFest 2026 events and competitions.',
            sections: [
              {
                id: 'personal_academic',
                title: 'Personal & Academic Details',
                fields: [
                  { name: 'fullName', label: 'Full Name', type: 'text', required: true },
                  { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
                  { name: 'email', label: 'Email Address', type: 'email', required: true },
                  { name: 'rollNo', label: 'Roll Number', type: 'text', required: true },
                  { name: 'branch', label: 'Branch', type: 'dropdown', options: ['CSE', 'AI & DS', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'], required: true },
                  { name: 'year', label: 'Year of Study', type: 'radio', options: ['1st Year', '2nd Year', '3rd Year', '4th Year'], required: true },
                ],
              },
              {
                id: 'events',
                title: 'Choose Events',
                fields: [
                  { name: 'events', label: 'Which events do you want to participate in?', type: 'checkbox', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
                  { name: 'preferredEvent', label: 'Select your primary event', type: 'dropdown', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
                ],
              },
              {
                id: 'team_confirmation',
                title: 'Team Details & Confirmation',
                fields: [
                  { name: 'participationType', label: 'Participation Type', type: 'radio', options: ['Individual', 'Team'], required: true },
                  { name: 'teamName', label: 'Team Name', type: 'text', required: false },
                  { name: 'teamMembers', label: 'Team Members', type: 'textarea', required: false },
                  { name: 'agree', label: 'I confirm that the information provided is correct.', type: 'checkbox', options: ['I Agree'], required: true },
                ],
              },
            ],
          },
          organizerId: organizer.id,
        },
      });
    } else {
      // Update existing event to use reference formStructure for testing
      await prisma.event.update({
        where: { id: existingEvent.id },
        data: {
          formStructure: {
            title: 'TechFest 2026 Registration',
            description: 'Register for TechFest 2026 events and competitions.',
            sections: [
              {
                id: 'personal_academic',
                title: 'Personal & Academic Details',
                fields: [
                  { name: 'fullName', label: 'Full Name', type: 'text', required: true },
                  { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
                  { name: 'email', label: 'Email Address', type: 'email', required: true },
                  { name: 'rollNo', label: 'Roll Number', type: 'text', required: true },
                  { name: 'branch', label: 'Branch', type: 'dropdown', options: ['CSE', 'AI & DS', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'], required: true },
                  { name: 'year', label: 'Year of Study', type: 'radio', options: ['1st Year', '2nd Year', '3rd Year', '4th Year'], required: true },
                ],
              },
              {
                id: 'events',
                title: 'Choose Events',
                fields: [
                  { name: 'events', label: 'Which events do you want to participate in?', type: 'checkbox', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
                  { name: 'preferredEvent', label: 'Select your primary event', type: 'dropdown', options: ['Hackathon', 'Coding Competition', 'AI Challenge', 'Paper Presentation', 'Quiz'], required: true },
                ],
              },
              {
                id: 'team_confirmation',
                title: 'Team Details & Confirmation',
                fields: [
                  { name: 'participationType', label: 'Participation Type', type: 'radio', options: ['Individual', 'Team'], required: true },
                  { name: 'teamName', label: 'Team Name', type: 'text', required: false },
                  { name: 'teamMembers', label: 'Team Members', type: 'textarea', required: false },
                  { name: 'agree', label: 'I confirm that the information provided is correct.', type: 'checkbox', options: ['I Agree'], required: true },
                ],
              },
            ],
          },
        },
      });
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
