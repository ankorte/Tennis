import { prisma } from './prisma'

interface SpielRef {
  id: number
  runde: string
  spielNummer: number
}

export async function generiereBracket(turnierId: number, spielerIds: number[]) {
  // Pad to 16 players with null for byes
  const spieler: (number | null)[] = [...spielerIds]
  while (spieler.length < 16) spieler.push(null)

  // Standard seeding for 16 players:
  // M1: seed1 vs seed16, M2: seed8 vs seed9, M3: seed5 vs seed12, M4: seed4 vs seed13
  // M5: seed3 vs seed14, M6: seed6 vs seed11, M7: seed7 vs seed10, M8: seed2 vs seed15
  // Indices are 0-based (spieler[0] = seed 1, spieler[15] = seed 16)
  const setzungsReihenfolge = [
    [0, 15], [7, 8], [4, 11], [3, 12],
    [2, 13], [5, 10], [6, 9], [1, 14]
  ]

  // Delete existing matches for this tournament
  await prisma.spiel.deleteMany({ where: { turnierId } })

  // Create all matches first (without connections)
  // WB R1: 8 matches
  const wbR1: SpielRef[] = []
  for (let i = 0; i < 8; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'WB-R1',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    wbR1.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // WB R2: 4 matches
  const wbR2: SpielRef[] = []
  for (let i = 0; i < 4; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'WB-R2',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    wbR2.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // WB SF: 2 matches
  const wbSF: SpielRef[] = []
  for (let i = 0; i < 2; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'WB-SF',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    wbSF.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // WB F: 1 match
  const wbF = await prisma.spiel.create({
    data: {
      turnierId,
      runde: 'WB-F',
      spielNummer: 1,
      status: 'ausstehend',
    },
  })

  // LB R1: 4 matches
  const lbR1: SpielRef[] = []
  for (let i = 0; i < 4; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'LB-R1',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    lbR1.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // LB R2: 4 matches
  const lbR2: SpielRef[] = []
  for (let i = 0; i < 4; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'LB-R2',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    lbR2.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // LB R3: 2 matches
  const lbR3: SpielRef[] = []
  for (let i = 0; i < 2; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'LB-R3',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    lbR3.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // LB R4: 2 matches
  const lbR4: SpielRef[] = []
  for (let i = 0; i < 2; i++) {
    const match = await prisma.spiel.create({
      data: {
        turnierId,
        runde: 'LB-R4',
        spielNummer: i + 1,
        status: 'ausstehend',
      },
    })
    lbR4.push({ id: match.id, runde: match.runde, spielNummer: match.spielNummer })
  }

  // LB SF: 1 match
  const lbSF = await prisma.spiel.create({
    data: {
      turnierId,
      runde: 'LB-SF',
      spielNummer: 1,
      status: 'ausstehend',
    },
  })

  // LB F: 1 match
  const lbF = await prisma.spiel.create({
    data: {
      turnierId,
      runde: 'LB-F',
      spielNummer: 1,
      status: 'ausstehend',
    },
  })

  // Grand Final: 1 match
  const gf = await prisma.spiel.create({
    data: {
      turnierId,
      runde: 'GF',
      spielNummer: 1,
      status: 'ausstehend',
    },
  })

  // Now set all connections and initial players

  // === WB R1 matches: set players ===
  for (let i = 0; i < 8; i++) {
    const [idx1, idx2] = setzungsReihenfolge[i]
    const s1 = spieler[idx1]
    const s2 = spieler[idx2]

    // Determine WB R2 target
    const wbR2Target = wbR2[Math.floor(i / 2)]
    const wbR2Slot = (i % 2) + 1

    // LB R1 target: WB R1 matches 1+2 -> LBR1_1, 3+4 -> LBR1_2, 5+6 -> LBR1_3, 7+8 -> LBR1_4
    const lbR1Target = lbR1[Math.floor(i / 2)]
    const lbR1Slot = (i % 2) + 1

    let status = 'ausstehend'
    let siegerId: number | null = null

    // Handle bye
    if (s1 === null && s2 === null) {
      status = 'walkover'
    } else if (s1 === null) {
      // s2 auto-advances
      siegerId = s2
      status = 'walkover'
    } else if (s2 === null) {
      // s1 auto-advances
      siegerId = s1
      status = 'walkover'
    }

    await prisma.spiel.update({
      where: { id: wbR1[i].id },
      data: {
        spieler1Id: s1,
        spieler2Id: s2,
        siegerId,
        status,
        siegerSpielId: wbR2Target.id,
        siegerSlot: wbR2Slot,
        verliererSpielId: lbR1Target.id,
        verliererSlot: lbR1Slot,
      },
    })

    // If walkover, propagate winner to WB R2 and loser to LB R1
    if (status === 'walkover') {
      const verlierer = s1 !== null ? null : null // both null if both null
      const winner = siegerId

      if (winner !== null) {
        // Place winner in WB R2
        if (wbR2Slot === 1) {
          await prisma.spiel.update({
            where: { id: wbR2Target.id },
            data: { spieler1Id: winner },
          })
        } else {
          await prisma.spiel.update({
            where: { id: wbR2Target.id },
            data: { spieler2Id: winner },
          })
        }

        // Place loser (null for bye) in LB R1
        const loserVal = s1 === null ? s1 : s2 // the null one
        if (lbR1Slot === 1) {
          await prisma.spiel.update({
            where: { id: lbR1Target.id },
            data: { spieler1Id: loserVal },
          })
        } else {
          await prisma.spiel.update({
            where: { id: lbR1Target.id },
            data: { spieler2Id: loserVal },
          })
        }
      }
    }
  }

  // === WB R2 connections ===
  // WBR2_1, WBR2_2 -> WBSF_1; WBR2_3, WBR2_4 -> WBSF_2
  for (let i = 0; i < 4; i++) {
    const wbSFTarget = wbSF[Math.floor(i / 2)]
    const wbSFSlot = (i % 2) + 1
    // LB R2: WBR2_i loser -> LBR2_i slot 2
    const lbR2Target = lbR2[i]

    await prisma.spiel.update({
      where: { id: wbR2[i].id },
      data: {
        siegerSpielId: wbSFTarget.id,
        siegerSlot: wbSFSlot,
        verliererSpielId: lbR2Target.id,
        verliererSlot: 2,
      },
    })
  }

  // === WB SF connections ===
  // WBSF_1, WBSF_2 -> WBF_1
  for (let i = 0; i < 2; i++) {
    await prisma.spiel.update({
      where: { id: wbSF[i].id },
      data: {
        siegerSpielId: wbF.id,
        siegerSlot: i + 1,
        verliererSpielId: lbR4[i].id,
        verliererSlot: 2,
      },
    })
  }

  // === WB F connections ===
  // WBF_1 winner -> GF slot 1, loser -> LBF slot 2
  await prisma.spiel.update({
    where: { id: wbF.id },
    data: {
      siegerSpielId: gf.id,
      siegerSlot: 1,
      verliererSpielId: lbF.id,
      verliererSlot: 2,
    },
  })

  // === LB R1 connections ===
  // LBR1_i winner -> LBR2_i slot 1
  for (let i = 0; i < 4; i++) {
    await prisma.spiel.update({
      where: { id: lbR1[i].id },
      data: {
        siegerSpielId: lbR2[i].id,
        siegerSlot: 1,
        // LB R1 losers are eliminated
        verliererSpielId: null,
        verliererSlot: null,
      },
    })
  }

  // Check for LB R1 byes (if both players are null or one is null)
  for (let i = 0; i < 4; i++) {
    const lbR1Match = await prisma.spiel.findUnique({ where: { id: lbR1[i].id } })
    if (lbR1Match) {
      if (lbR1Match.spieler1Id === null && lbR1Match.spieler2Id === null) {
        // Both bye - this LBR2 slot gets null
      } else if (lbR1Match.spieler1Id === null || lbR1Match.spieler2Id === null) {
        // One bye - auto advance
        const winner = lbR1Match.spieler1Id ?? lbR1Match.spieler2Id
        await prisma.spiel.update({
          where: { id: lbR1[i].id },
          data: { siegerId: winner, status: 'walkover' },
        })
        // Place in LBR2 slot 1
        await prisma.spiel.update({
          where: { id: lbR2[i].id },
          data: { spieler1Id: winner },
        })
      }
    }
  }

  // === LB R2 connections ===
  // LBR2_1, LBR2_2 -> LBR3_1; LBR2_3, LBR2_4 -> LBR3_2
  for (let i = 0; i < 4; i++) {
    const lbR3Target = lbR3[Math.floor(i / 2)]
    const lbR3Slot = (i % 2) + 1

    await prisma.spiel.update({
      where: { id: lbR2[i].id },
      data: {
        siegerSpielId: lbR3Target.id,
        siegerSlot: lbR3Slot,
        verliererSpielId: null,
        verliererSlot: null,
      },
    })
  }

  // === LB R3 connections ===
  // LBR3_1 -> LBR4_1 slot 1; LBR3_2 -> LBR4_2 slot 1
  for (let i = 0; i < 2; i++) {
    await prisma.spiel.update({
      where: { id: lbR3[i].id },
      data: {
        siegerSpielId: lbR4[i].id,
        siegerSlot: 1,
        verliererSpielId: null,
        verliererSlot: null,
      },
    })
  }

  // === LB R4 connections ===
  // LBR4_1 -> LBSF slot 1; LBR4_2 -> LBSF slot 2
  for (let i = 0; i < 2; i++) {
    await prisma.spiel.update({
      where: { id: lbR4[i].id },
      data: {
        siegerSpielId: lbSF.id,
        siegerSlot: i + 1,
        verliererSpielId: null,
        verliererSlot: null,
      },
    })
  }

  // === LB SF connections ===
  // LBSF -> LBF slot 1
  await prisma.spiel.update({
    where: { id: lbSF.id },
    data: {
      siegerSpielId: lbF.id,
      siegerSlot: 1,
      verliererSpielId: null,
      verliererSlot: null,
    },
  })

  // === LB F connections ===
  // LBF winner -> GF slot 2
  await prisma.spiel.update({
    where: { id: lbF.id },
    data: {
      siegerSpielId: gf.id,
      siegerSlot: 2,
      verliererSpielId: null,
      verliererSlot: null,
    },
  })

  // GF has no next match
  await prisma.spiel.update({
    where: { id: gf.id },
    data: {
      siegerSpielId: null,
      siegerSlot: null,
      verliererSpielId: null,
      verliererSlot: null,
    },
  })

  // Cascade all walkovers through the entire bracket until stable
  await cascadeWalkovers(turnierId)

  return await prisma.spiel.findMany({
    where: { turnierId },
    orderBy: [{ runde: 'asc' }, { spielNummer: 'asc' }],
  })
}

// Propagates all walkover winners through the bracket round by round until stable.
// Processes each round in order: places winners in next matches, then marks
// any single-player next-round matches as walkover. Repeats until no changes.
async function cascadeWalkovers(turnierId: number) {
  // Process in bracket order so earlier rounds feed later ones correctly
  const roundOrder = [
    'WB-R1', 'LB-R1',
    'WB-R2', 'LB-R2',
    'WB-SF', 'LB-R3',
    'LB-R4', 'WB-F',
    'LB-SF', 'LB-F',
  ]

  let changed = true
  while (changed) {
    changed = false

    for (const runde of roundOrder) {
      const walkovers = await prisma.spiel.findMany({
        where: { turnierId, runde, status: 'walkover' },
      })

      for (const w of walkovers) {
        if (w.siegerId === null || w.siegerSpielId === null || w.siegerSlot === null) continue

        const nextMatch = await prisma.spiel.findUnique({ where: { id: w.siegerSpielId } })
        if (!nextMatch) continue

        // Check if winner is already placed in the correct slot
        const alreadyPlaced =
          w.siegerSlot === 1
            ? nextMatch.spieler1Id === w.siegerId
            : nextMatch.spieler2Id === w.siegerId
        if (alreadyPlaced) continue

        // Place winner in the correct slot
        await prisma.spiel.update({
          where: { id: w.siegerSpielId },
          data: w.siegerSlot === 1
            ? { spieler1Id: w.siegerId }
            : { spieler2Id: w.siegerId },
        })
        changed = true
      }
    }

    // After each pass: mark any ausstehend match with exactly one player as walkover
    const ausstehend = await prisma.spiel.findMany({
      where: { turnierId, status: 'ausstehend' },
    })
    for (const m of ausstehend) {
      if (m.spieler1Id !== null && m.spieler2Id === null) {
        await prisma.spiel.update({
          where: { id: m.id },
          data: { siegerId: m.spieler1Id, status: 'walkover' },
        })
        changed = true
      } else if (m.spieler1Id === null && m.spieler2Id !== null) {
        await prisma.spiel.update({
          where: { id: m.id },
          data: { siegerId: m.spieler2Id, status: 'walkover' },
        })
        changed = true
      }
    }
  }
}

// Checks whether a slot in a match is a "permanent bye" —
// i.e. no real player will ever arrive there through the bracket.
// Returns true  → safe to auto-advance the other player (it is a structural bye).
// Returns false → the slot is waiting for a real match result; do NOT auto-advance.
async function isPermanentBye(matchId: number, slot: number): Promise<boolean> {
  const feeders = await prisma.spiel.findMany({
    where: {
      OR: [
        { siegerSpielId: matchId, siegerSlot: slot },
        { verliererSpielId: matchId, verliererSlot: slot },
      ],
    },
  })

  // No feeder at all → structural bye by design
  if (feeders.length === 0) return true

  for (const f of feeders) {
    const isWinnerFeeder =
      f.siegerSpielId === matchId && f.siegerSlot === slot

    if (f.status === 'abgeschlossen' || f.status === 'walkover') {
      // Feeder is finished – decide what player it sends to this slot
      if (isWinnerFeeder) {
        if (f.siegerId !== null) return false // real winner on the way
      } else {
        // Loser feeder: loser is whichever player is NOT the sieger
        const loser =
          f.siegerId !== null
            ? f.spieler1Id === f.siegerId
              ? f.spieler2Id
              : f.spieler1Id
            : null
        if (loser !== null) return false // real loser on the way
      }
      // sieger/loser is null → bye, continue checking other feeders
    } else {
      // Feeder is still pending
      if (f.spieler1Id !== null || f.spieler2Id !== null) return false // has real players
      // No players yet – check recursively up the tree
      const bye1 = await isPermanentBye(f.id, 1)
      const bye2 = await isPermanentBye(f.id, 2)
      if (!bye1 || !bye2) return false // real player exists somewhere upstream
    }
  }

  return true // every path leads to null → permanent bye
}

async function propagatePlayer(
  nextMatchId: number,
  nextSlot: number,
  playerId: number
) {
  // Place player in slot
  await prisma.spiel.update({
    where: { id: nextMatchId },
    data: nextSlot === 1 ? { spieler1Id: playerId } : { spieler2Id: playerId },
  })

  // Re-fetch to see current state
  const m = await prisma.spiel.findUnique({ where: { id: nextMatchId } })
  if (!m || m.status === 'abgeschlossen' || m.status === 'walkover') return

  const otherSlot = nextSlot === 1 ? 2 : 1
  const otherPlayer = otherSlot === 1 ? m.spieler1Id : m.spieler2Id

  // Only auto-advance if the other slot is a permanent bye
  if (otherPlayer === null) {
    const bye = await isPermanentBye(nextMatchId, otherSlot)
    if (bye) {
      await prisma.spiel.update({
        where: { id: nextMatchId },
        data: { siegerId: playerId, status: 'walkover' },
      })
      // Cascade the auto-advance winner further
      const updated = await prisma.spiel.findUnique({ where: { id: nextMatchId } })
      if (updated?.siegerSpielId && updated.siegerSlot) {
        await propagatePlayer(updated.siegerSpielId, updated.siegerSlot, playerId)
      }
    }
  }
}

export async function verarbeiteErgebnis(spielId: number, siegerId: number, ergebnis: string) {
  const spiel = await prisma.spiel.findUnique({ where: { id: spielId } })
  if (!spiel) throw new Error('Spiel nicht gefunden')

  const verlierer =
    spiel.spieler1Id === siegerId ? spiel.spieler2Id : spiel.spieler1Id

  // Save result
  await prisma.spiel.update({
    where: { id: spielId },
    data: { siegerId, ergebnis, status: 'abgeschlossen' },
  })

  // Propagate winner
  if (spiel.siegerSpielId !== null && spiel.siegerSlot !== null) {
    await propagatePlayer(spiel.siegerSpielId, spiel.siegerSlot, siegerId)
  }

  // Propagate loser
  if (spiel.verliererSpielId !== null && spiel.verliererSlot !== null && verlierer !== null) {
    await propagatePlayer(spiel.verliererSpielId, spiel.verliererSlot, verlierer)
  }
}
