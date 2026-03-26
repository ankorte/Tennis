import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthFromRequest(request)
    if (!auth || auth.rolle !== 'admin') {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const anmeldungId = parseInt(params.id)
    const body = await request.json()
    const { setzung } = body

    if (setzung !== undefined && (setzung < 1 || setzung > 16)) {
      return NextResponse.json({ error: 'Setzung muss zwischen 1 und 16 liegen' }, { status: 400 })
    }

    const anmeldung = await prisma.anmeldung.update({
      where: { id: anmeldungId },
      data: { setzung: setzung ?? null },
      include: { spieler: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ anmeldung })
  } catch (error) {
    console.error('Update seeding error:', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Setzung' }, { status: 500 })
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

    const anmeldungId = parseInt(params.id)

    const anmeldung = await prisma.anmeldung.findUnique({
      where: { id: anmeldungId },
      include: { turnier: { select: { status: true } }, spieler: { select: { name: true } } },
    })

    if (!anmeldung) {
      return NextResponse.json({ error: 'Anmeldung nicht gefunden' }, { status: 404 })
    }

    if (anmeldung.turnier?.status !== 'anmeldung') {
      return NextResponse.json(
        { error: 'Spieler kann nur während der Anmeldephase abgemeldet werden' },
        { status: 400 }
      )
    }

    await prisma.anmeldung.delete({ where: { id: anmeldungId } })

    return NextResponse.json({ message: `${anmeldung.spieler?.name ?? 'Spieler'} wurde abgemeldet` })
  } catch (error) {
    console.error('Delete anmeldung error:', error)
    return NextResponse.json({ error: 'Fehler beim Abmelden' }, { status: 500 })
  }
}
