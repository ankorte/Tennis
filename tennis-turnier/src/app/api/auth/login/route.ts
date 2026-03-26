import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-Mail und Passwort sind erforderlich' },
        { status: 400 }
      )
    }

    const spieler = await prisma.spieler.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!spieler) {
      return NextResponse.json(
        { error: 'Ungültige E-Mail oder Passwort' },
        { status: 401 }
      )
    }

    const passwordValid = await verifyPassword(password, spieler.passwortHash)

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Ungültige E-Mail oder Passwort' },
        { status: 401 }
      )
    }

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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Anmeldung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
