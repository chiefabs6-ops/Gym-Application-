import { PrismaClient } from '@prisma/client';
import { DEFAULT_EXERCISES } from '@gym/shared';

const prisma = new PrismaClient();
const epoch = new Date(0);

try {
  for (const ex of DEFAULT_EXERCISES) {
    const data = {
      name: ex.name,
      primaryMuscle: ex.primary_muscle,
      equipment: ex.equipment,
      category: ex.category,
      trackingType: ex.tracking_type,
    };
    await prisma.exerciseDefinition.upsert({
      where: { id: ex.id },
      create: { id: ex.id, userId: null, ...data, createdAt: epoch, updatedAt: epoch },
      update: data,
    });
  }
  console.log(`Seeded ${DEFAULT_EXERCISES.length} canonical exercises`);
} finally {
  await prisma.$disconnect();
}
