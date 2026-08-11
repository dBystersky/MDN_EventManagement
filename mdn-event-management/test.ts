import { prisma } from "./lib/prisma";

async function main() {
  // Create a new user with a post
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {}, // Leave empty if you don't want to change existing data
    create: {
      email: 'test@example.com',
      name: 'Test User',
      posts: {
        create: { title: 'My First Post' },
      },
    },
  });
  console.log("Created user:", user);

  // Fetch all users with their posts
  const allUsers = await prisma.user.findMany({
    include: {
      posts: true,
    },
  });
  console.log("All users:", JSON.stringify(allUsers, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });