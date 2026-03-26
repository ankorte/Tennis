import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    // Validate inputs
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, E-Mail und Passwort sind erforderlich' },
        { status: 400 }
      )
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name muss mindestens 2 Zeichen lang sein' },
        { status: 400 }
      )
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Ungültige E-Mail-Adresse' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Passwort muss mindestens 6 Zeichen lang sein' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await prisma.spieler.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Diese E-Mail-Adresse ist bereits registriert' },
        { status: 409 }
      )
    }

    // Hash password and create user
    const passwortHash = await hashPassword(password)

    const spieler = await prisma.spieler.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwortHash,
        rolle: 'spieler',
      },
    })

    const token = generateToken(spieler.id, spieler.rolle)

    return NextResponse.json({
      token,
      user: {
        id: spieler.id,
        name: spieler.name,
        email: spieler.email,
        rolle: spieler.rolle,
      },
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Registrierung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
