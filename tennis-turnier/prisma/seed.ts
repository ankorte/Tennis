import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.spieler.upsert({
    where: { email: 'admin@tennis.de' },
    update: {},
    create: {
      name: 'Administrator',
      email: 'admin@tennis.de',
      passwortHash: adminHash,
      rolle: 'admin',
    },
  })
  console.log('Admin created:', admin.email)

  // Create 4 tournaments (only if they don't exist yet)
  const turnierData = [
    {
      name: 'Frühjahrsturnier 2025',
      beschreibung: 'Das traditionelle Frühjahrsturnier des Tennisclubs. Spieler aller Stärken sind willkommen.',
    },
    {
      name: 'Sommerturnier 2025',
      beschreibung: 'Unser größtes Turnier des Jahres mit spannenden Matches und tollem Rahmenprogramm.',
    },
    {
      name: 'Herbstturnier 2025',
      beschreibung: 'Das Herbstturnier läutet die Hallensaison ein. Double Elimination für maximale Spannung.',
    },
    {
      name: 'Winterturnier 2025',
      beschreibung: 'Das Winterturnier findet in der Halle statt. Ideal für alle Wettkampfspieler.',
    },
  ]

  for (const t of turnierData) {
    // Check if already exists
    const existing = await prisma.turnier.findFirst({
      where: { name: t.name },
    })
    if (!existing) {
      const created = await prisma.turnier.create({
        data: {
          ...t,
          status: 'anmeldung',
          maxSpieler: 16,
        },
      })
      console.log('Tournament created:', created.name)
    } else {
      console.log('Tournament already exists:', existing.name)
    }
  }

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
