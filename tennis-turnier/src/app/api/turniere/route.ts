import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    const turniere = await prisma.turnier.findMany({
      orderBy: { erstelltAm: 'asc' },
      include: {
        _count: {
          select: { anmeldungen: true },
        },
      },
    })

    return NextResponse.json({ turniere })
  } catch (error) {
    console.error('Get tournaments error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Turniere' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, beschreibung } = body

    if (!name || name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Turniername muss mindestens 3 Zeichen lang sein' },
        { status: 400 }
      )
    }

    const turnier = await prisma.turnier.create({
      data: {
        name: name.trim(),
        beschreibung: beschreibung?.trim() || null,
        status: 'anmeldung',
        maxSpieler: 16,
      },
    })

    return NextResponse.json({ turnier }, { status: 201 })
  } catch (error) {
    console.error('Create tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Turniers' },
      { status: 500 }
    )
  }
}
