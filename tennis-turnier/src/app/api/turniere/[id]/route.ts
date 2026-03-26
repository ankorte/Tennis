import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Ungültige Turnier-ID' }, { status: 400 })
    }

    const turnier = await prisma.turnier.findUnique({
      where: { id },
      include: {
        anmeldungen: {
          include: {
            spieler: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { setzung: 'asc' },
        },
        spiele: {
          include: {
            spieler1: { select: { id: true, name: true } },
            spieler2: { select: { id: true, name: true } },
            sieger: { select: { id: true, name: true } },
          },
          orderBy: [{ runde: 'asc' }, { spielNummer: 'asc' }],
        },
        _count: {
          select: { anmeldungen: true },
        },
      },
    })

    if (!turnier) {
      return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ turnier })
  } catch (error) {
    console.error('Get tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen des Turniers' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)

    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const id = parseInt(params.id)
    const body = await request.json()
    const { name, beschreibung, status } = body

    const turnier = await prisma.turnier.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(beschreibung !== undefined && { beschreibung }),
        ...(status && { status }),
      },
    })

    return NextResponse.json({ turnier })
  } catch (error) {
    console.error('Update tournament error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren des Turniers' },
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
    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    const id = parseInt(params.id)
    // Cascade delete via Prisma relations (spiele + anmeldungen first)
    await prisma.spiel.deleteMany({ where: { turnierId: id } })
    await prisma.anmeldung.deleteMany({ where: { turnierId: id } })
    await prisma.turnier.delete({ where: { id } })
    return NextResponse.json({ message: 'Turnier gelöscht' })
  } catch (error) {
    console.error('Delete tournament error:', error)
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }
}
