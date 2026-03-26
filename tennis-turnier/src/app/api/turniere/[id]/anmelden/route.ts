import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const turnierId = parseInt(params.id)

    const turnier = await prisma.turnier.findUnique({
      where: { id: turnierId },
      include: { _count: { select: { anmeldungen: true } } },
    })

    if (!turnier) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    }

    if (turnier.status !== 'anmeldung') {
      return NextResponse.json(
        { error: 'Anmeldung ist für dieses Turnier nicht mehr möglich' },
        { status: 400 }
      )
    }

    if (turnier._count.anmeldungen >= turnier.maxSpieler) {
      return NextResponse.json(
        { error: 'Das Turnier ist bereits voll' },
        { status: 400 }
      )
    }

    const existing = await prisma.anmeldung.findUnique({
      where: {
        turnierId_spielerId: {
          turnierId,
          spielerId: auth.userId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Sie sind bereits für dieses Turnier angemeldet' },
        { status: 409 }
      )
    }

    const anmeldung = await prisma.anmeldung.create({
      data: {
        turnierId,
        spielerId: auth.userId,
      },
      include: {
        spieler: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ anmeldung }, { status: 201 })
  } catch (error) {
    console.error('Register for tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler bei der Anmeldung' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const turnierId = parseInt(params.id)

    const turnier = await prisma.turnier.findUnique({
      where: { id: turnierId },
    })

    if (!turnier) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    }

    if (turnier.status !== 'anmeldung') {
      return NextResponse.json(
        { error: 'Abmeldung ist nicht mehr möglich' },
        { status: 400 }
      )
    }

    await prisma.anmeldung.delete({
      where: {
        turnierId_spielerId: {
          turnierId,
          spielerId: auth.userId,
        },
      },
    })

    return NextResponse.json({ message: 'Erfolgreich abgemeldet' })
  } catch (error) {
    console.error('Unregister from tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler bei der Abmeldung' },
      { status: 500 }
    )
  }
}
