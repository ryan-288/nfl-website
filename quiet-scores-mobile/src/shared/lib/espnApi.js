const ESPN_APIS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  'college-football':
    'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'college-basketball':
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
}

const ESPN_SUMMARY_APIS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary',
  'college-football':
    'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary',
  'college-basketball':
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary',
}

function formatDateParam(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeStatus(status, detail, shortDetail) {
  const detailLower = (detail || '').toLowerCase()
  const shortLower = (shortDetail || '').toLowerCase()
  const combined = detailLower || shortLower

  if (combined.includes('postponed') || combined.includes('canceled')) {
    return 'postponed'
  }

  if (combined.includes('halftime')) {
    return 'halftime'
  }

  switch (status) {
    case 'pre':
      return 'scheduled'
    case 'post':
    case 'final':
      return 'final'
    case 'in':
      if (combined.includes('end')) {
        return 'halftime'
      }
      return 'live'
    default:
      if (combined.includes('final')) return 'final'
      if (combined.includes('live')) return 'live'
      return 'scheduled'
  }
}

function formatDisplayTime(eventDate) {
  try {
    const date = new Date(eventDate)
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'TBD'
  }
}

function extractRecord(competitor) {
  const records = competitor?.records
  if (!records || records.length === 0) return null
  const total = records.find((record) => record.type === 'total')
  return (total ?? records[0])?.summary ?? null
}

function pickTeamLogo(team) {
  if (!team) return null
  if (Array.isArray(team.logos) && team.logos.length > 0) {
    const alternates = team.logos.filter((entry) => 
      Boolean(entry.href) && (
        entry.href.toLowerCase().includes('alternate') ||
        entry.href.toLowerCase().includes('alt') ||
        entry.href.toLowerCase().includes('light') ||
        entry.href.toLowerCase().includes('white')
      )
    )
    
    if (alternates.length > 0 && alternates[0]?.href) {
      return alternates[0].href
    }
    
    const nonPrimary = team.logos.find((entry) => 
      Boolean(entry.href) && 
      !entry.href.toLowerCase().includes('dark') &&
      !entry.href.toLowerCase().includes('black')
    ) ?? team.logos.find((entry) => Boolean(entry.href))
    
    if (nonPrimary?.href) return nonPrimary.href
    
    const primary = team.logos.find((entry) => Boolean(entry.href)) ?? team.logos[0]
    if (primary?.href) return primary.href
  }
  if (team.logo) return team.logo
  return null
}

function transformEvent(event, sportKey) {
  if (!event) return null
  const competition = event.competitions?.[0]
  if (!competition) return null

  const competitors = competition.competitors ?? []
  if (competitors.length === 0) return null

  const home =
    competitors.find((comp) => comp.homeAway === 'home') ?? competitors[1] ?? null
  const away =
    competitors.find((comp) => comp.homeAway === 'away') ?? competitors[0] ?? null

  if (!home || !away) return null

  const status = event.status ?? {}
  const statusType = status.type ?? {}
  const normalizedStatus = normalizeStatus(
    statusType.state,
    statusType.detail,
    statusType.shortDetail,
  )

  const timeDetail =
    statusType.shortDetail ||
    statusType.detail ||
    statusType.description ||
    ''

  const homeTeamName = home.team?.displayName || home.team?.name
  const awayTeamName = away.team?.displayName || away.team?.name

  if (!homeTeamName || !awayTeamName) return null

  const homeLogo = pickTeamLogo(home.team)
  const awayLogo = pickTeamLogo(away.team)
  const homeShortName = home.team?.shortDisplayName || home.team?.abbreviation
  const awayShortName = away.team?.shortDisplayName || away.team?.abbreviation
  const homeAbbreviation = home.team?.abbreviation || null
  const awayAbbreviation = away.team?.abbreviation || null

  let possessionTeam = null
  const situation = competition?.situation
  if (situation?.possession) {
    // Possession might be an ID string/number or an object with team/id
    if (typeof situation.possession === 'object') {
      possessionTeam = situation.possession.team?.id || situation.possession.id || situation.possession
    } else {
      possessionTeam = situation.possession
    }
  }
  // Also check for possession in the lastPlay if situation doesn't have it
  if (!possessionTeam && competition?.lastPlay) {
    const lastPlay = competition.lastPlay
    if (lastPlay?.team?.id) {
      possessionTeam = lastPlay.team.id
    } else if (lastPlay?.possessionTeam) {
      possessionTeam = lastPlay.possessionTeam
    }
  }
  // Check if possession is stored in situation.lastPlay
  if (!possessionTeam && situation?.lastPlay) {
    const lastPlay = situation.lastPlay
    if (lastPlay?.team?.id) {
      possessionTeam = lastPlay.team.id
    } else if (lastPlay?.possessionTeam) {
      possessionTeam = lastPlay.possessionTeam
    }
  }

  let atBatTeam = null
  let inningNumber = null
  let topBottom = null
  let bases = null
  let balls = null
  let strikes = null
  let outs = null

  if (sportKey === 'mlb') {
    if (situation?.inningHalf) {
      atBatTeam = situation.inningHalf === 'top' ? 'away' : 'home'
    }

    if (situation?.inning !== undefined && situation.inning !== null) {
      inningNumber = situation.inning
    } else if (status.period) {
      inningNumber = status.period
    }

    if (situation?.topOfInning !== undefined && situation.topOfInning !== null) {
      topBottom = situation.topOfInning ? 'top' : 'bot'
    } else if (situation?.inningHalf !== undefined && situation.inningHalf !== null) {
      if (situation.inningHalf === 1 || situation.inningHalf === 'top') {
        topBottom = 'top'
      } else if (situation.inningHalf === 2 || situation.inningHalf === 'bottom') {
        topBottom = 'bot'
      }
    } else if (situation?.inningHalf) {
      topBottom = situation.inningHalf === 'top' ? 'top' : 'bot'
    }

    if (situation?.balls !== undefined && situation.balls !== null) {
      balls = situation.balls
    }
    if (situation?.strikes !== undefined && situation.strikes !== null) {
      strikes = situation.strikes
    }
    if (situation?.outs !== undefined && situation.outs !== null) {
      outs = situation.outs
    }

    const onFirst = situation?.onFirst
    const onSecond = situation?.onSecond
    const onThird = situation?.onThird

    if (onFirst && onSecond && onThird) {
      bases = 'loaded'
    } else if (onFirst && onSecond && !onThird) {
      bases = '1st & 2nd'
    } else if (onFirst && !onSecond && onThird) {
      bases = '1st & 3rd'
    } else if (!onFirst && onSecond && onThird) {
      bases = '2nd & 3rd'
    } else if (onFirst && !onSecond && !onThird) {
      bases = '1st'
    } else if (!onFirst && onSecond && !onThird) {
      bases = '2nd'
    } else if (!onFirst && !onSecond && onThird) {
      bases = '3rd'
    } else {
      bases = 'empty'
    }
  }

  const baseGame = {
    id: event.id ?? `${sportKey}-${awayTeamName}-${homeTeamName}`,
    sport: sportKey,
    sportName: event.name || sportKey.toUpperCase(),
    awayTeam: awayTeamName,
    homeTeam: homeTeamName,
    awayScore: away.score ?? '',
    homeScore: home.score ?? '',
    awayTeamRecord: extractRecord(away),
    homeTeamRecord: extractRecord(home),
    status: normalizedStatus,
    time: timeDetail,
    displayTime: normalizedStatus === 'scheduled' ? formatDisplayTime(event.date) : '',
    fullDateTime: event.date,
    gameDate: event.date,
    period: status.period,
    clock: status.clock,
    homeLogo,
    awayLogo,
    homeShortName,
    awayShortName,
    homeAbbreviation,
    awayAbbreviation,
    possessionTeam: possessionTeam ? String(possessionTeam) : null,
    awayTeamId: away.team?.id ? String(away.team.id) : null,
    homeTeamId: home.team?.id ? String(home.team.id) : null,
    atBatTeam,
    inningNumber,
    topBottom,
    bases,
    balls,
    strikes,
    outs,
  }

  let broadcastChannel = null
  
  if (event.broadcast) {
    broadcastChannel = event.broadcast
  }
  else if (competition?.broadcasts && competition.broadcasts.length > 0) {
    const broadcast = competition.broadcasts[0]
    if (broadcast.names && broadcast.names.length > 0) {
      broadcastChannel = broadcast.names[0]
    }
    else if (broadcast.media?.shortName) {
      broadcastChannel = broadcast.media.shortName
    }
  }
  else if (event.geoBroadcasts && event.geoBroadcasts.length > 0) {
    const geoBroadcast = event.geoBroadcasts[0]
    if (geoBroadcast.media?.shortName) {
      broadcastChannel = geoBroadcast.media.shortName
    }
  }
  else if (event.broadcasts && event.broadcasts.length > 0) {
    const broadcast = event.broadcasts[0]
    if (broadcast.names && broadcast.names.length > 0) {
      broadcastChannel = broadcast.names[0]
    }
  }

  if (broadcastChannel) {
    baseGame.broadcastChannel = broadcastChannel
  }

  let spread = null
  let overUnder = null
  let awayMoneyline = null
  let homeMoneyline = null

  if (competition?.odds && competition.odds.length > 0) {
    const odds = competition.odds[0]

    if (odds.pointSpread) {
      const pointSpread = odds.pointSpread
      if (pointSpread.away?.close?.line !== undefined) {
        spread = pointSpread.away.close.line
      } else if (pointSpread.home?.close?.line !== undefined) {
        spread = -pointSpread.home.close.line
      }
    }

    if (odds.overUnder) {
      const total = odds.overUnder
      if (total.close?.line !== undefined) {
        overUnder = total.close.line
      }
    }

    if (odds.moneyline) {
      const moneyline = odds.moneyline
      if (moneyline.away?.close?.line !== undefined) {
        awayMoneyline = moneyline.away.close.line
      }
      if (moneyline.home?.close?.line !== undefined) {
        homeMoneyline = moneyline.home.close.line
      }
    }
  }

  if (spread !== null || overUnder !== null || awayMoneyline !== null || homeMoneyline !== null) {
    baseGame.odds = {
      spread,
      overUnder,
      awayMoneyline,
      homeMoneyline,
    }
  }

  return baseGame
}

async function fetchSportScoreboard(sportKey, date, { signal } = {}) {
  const endpoint = ESPN_APIS[sportKey]
  if (!endpoint) return []

  const url = `${endpoint}?dates=${formatDateParam(date)}`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${sportKey} scoreboard: ${response.status}`)
  }

  const data = await response.json()
  const events = data?.events ?? []

  return events
    .map((event) => transformEvent(event, sportKey))
    .filter(Boolean)
}

async function fetchAllScoreboards(date, { signal } = {}) {
  const sportKeys = Object.keys(ESPN_APIS)

  const results = await Promise.allSettled(
    sportKeys.map((sport) => fetchSportScoreboard(sport, date, { signal })),
  )

  const scores = []
  results.forEach((result) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      scores.push(...result.value)
    }
  })

  return scores
}

async function fetchGameSummary(sportKey, gameId, { signal } = {}) {
  const endpoint = ESPN_SUMMARY_APIS[sportKey]
  if (!endpoint) {
    throw new Error(`No summary endpoint for sport: ${sportKey}`)
  }

  const url = `${endpoint}?event=${gameId}`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch game summary: ${response.status}`)
  }

  const data = await response.json()
  return data
}

export { ESPN_APIS, ESPN_SUMMARY_APIS, fetchAllScoreboards, fetchSportScoreboard, fetchGameSummary }

