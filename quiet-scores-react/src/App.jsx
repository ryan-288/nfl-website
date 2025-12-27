import { useEffect, useMemo, useRef, useState } from 'react'
import { useScores } from './hooks/useScores'
import { fetchGameSummary } from './lib/espnApi'

const SPORT_BUTTONS = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'NBA', value: 'nba' },
  { label: 'MLB', value: 'mlb' },
  { label: 'NHL', value: 'nhl' },
  { label: 'CFB', value: 'college-football' },
  { label: 'CBB', value: 'college-basketball' },
]


const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const JS_DAY_TO_KEY = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const MILLISECONDS_IN_DAY = 86_400_000

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getMonday(date) {
  const jsDay = date.getDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return stripTime(monday)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatWeekLabel(offset) {
  if (offset === 0) return 'Current Week'
  const abs = Math.abs(offset)
  const suffix = abs === 1 ? 'Week' : 'Weeks'
  return offset > 0 ? `${abs} ${suffix} Ahead` : `${abs} ${suffix} Ago`
}

function formatDateLabel(date) {
  if (!date) return '-'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayKeyFromDate(date) {
  return JS_DAY_TO_KEY[date.getDay()]
}

function getSportDisplayName(sport) {
  switch (sport) {
    case 'nfl':
      return 'NFL'
    case 'nba':
      return 'NBA'
    case 'mlb':
      return 'MLB'
    case 'nhl':
      return 'NHL'
    case 'college-football':
      return 'CFB'
    case 'college-basketball':
      return 'CBB'
    default:
      return sport?.toUpperCase() ?? 'SPORT'
  }
}

function abbreviateNetwork(network) {
  if (!network) return ''
  
  const networkLower = network.toLowerCase()
  
  // Common network abbreviations
  const abbreviations = {
    'espn': 'ESPN',
    'espn2': 'ESPN2',
    'espnu': 'ESPNU',
    'espn+': 'ESPN+',
    'abc': 'ABC',
    'cbs': 'CBS',
    'nbc': 'NBC',
    'fox': 'FOX',
    'fs1': 'FS1',
    'fs2': 'FS2',
    'fox sports 1': 'FS1',
    'fox sports 2': 'FS2',
    'sec network': 'SECN',
    'secn': 'SECN',
    'big ten network': 'BTN',
    'btn': 'BTN',
    'acc network': 'ACCN',
    'accn': 'ACCN',
    'pac-12 network': 'PAC12',
    'pac12': 'PAC12',
    'tnt': 'TNT',
    'tbs': 'TBS',
    'nfl network': 'NFLN',
    'nfln': 'NFLN',
    'nba tv': 'NBATV',
    'nbav': 'NBATV',
    'mlb network': 'MLBN',
    'mlbn': 'MLBN',
    'nhl network': 'NHLN',
    'nhl': 'NHL',
  }
  
  // Check for exact match first
  if (abbreviations[networkLower]) {
    return abbreviations[networkLower]
  }
  
  // Check for partial matches
  for (const [key, abbrev] of Object.entries(abbreviations)) {
    if (networkLower.includes(key)) {
      return abbrev
    }
  }
  
  // If network name is long, abbreviate it
  if (network.length > 8) {
    // Take first 3-4 letters and make uppercase
    const words = network.split(' ')
    if (words.length > 1) {
      // Multiple words - take first letter of each
      return words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 4)
    } else {
      // Single word - take first 4-5 chars
      return network.slice(0, 5).toUpperCase()
    }
  }
  
  return network
}

function getTeamInitials(teamName) {
  if (!teamName) return '?'
  const cleaned = teamName.trim()
  if (cleaned.length <= 4 && !cleaned.includes(' ')) {
    return cleaned.toUpperCase()
  }
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (
    words[0].charAt(0).toUpperCase() + words[words.length - 1].charAt(0).toUpperCase()
  )
}

function getFallbackText(fullName, shortName, abbreviation) {
  if (abbreviation) return abbreviation.toUpperCase()
  if (shortName) return getTeamInitials(shortName)
  return getTeamInitials(fullName)
}

function getTeamColor(team, fallbackColor = '#007bff') {
  if (!team) return fallbackColor
  // ESPN API provides color in team.color or team.alternateColor
  if (team.color) return team.color
  if (team.alternateColor) return team.alternateColor
  // Check if colors are nested in team object
  if (team.team?.color) return team.team.color
  if (team.team?.alternateColor) return team.team.alternateColor
  return fallbackColor
}

function hexToRgba(hex, alpha = 0.9) {
  if (!hex || typeof hex !== 'string') return `rgba(0, 123, 255, ${alpha})`
  // Remove # if present
  const cleaned = hex.replace('#', '')
  // Handle 3-character hex codes
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Handle 6-character hex codes
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16)
    const g = parseInt(cleaned.slice(2, 4), 16)
    const b = parseInt(cleaned.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0, 123, 255, ${alpha})`
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Fallback for invalid hex
  return `rgba(0, 123, 255, ${alpha})`
}

function getWinner(game) {
  const awayScore = Number(game.awayScore)
  const homeScore = Number(game.homeScore)
  if (Number.isNaN(awayScore) || Number.isNaN(homeScore)) return null
  if (awayScore === homeScore) return null
  return awayScore > homeScore ? 'away' : 'home'
}

function getInningDisplay(game) {
  if (game.sport !== 'mlb' || !game.inningNumber) return ''
  
  const inningText = game.inningNumber === 1 ? '1st' :
                     game.inningNumber === 2 ? '2nd' :
                     game.inningNumber === 3 ? '3rd' :
                     `${game.inningNumber}th`
  
  let inningState = ''
  if (game.topBottom === 'top') {
    inningState = 'Top'
  } else if (game.topBottom === 'bot' || game.topBottom === 'bottom') {
    inningState = 'Bot'
  } else if (game.topBottom === 'mid' || game.topBottom === 'middle') {
    inningState = 'Mid'
  } else if (game.topBottom === 'end') {
    inningState = 'End'
  }
  
  return inningState ? `${inningState} ${inningText}` : ''
}

function getStatusBadge(game) {
  const timeText = game.time || ''
  
  // For MLB live games, show inning display
  if (game.sport === 'mlb' && game.status === 'live' && game.inningNumber) {
    const inningDisplay = getInningDisplay(game)
    if (inningDisplay) {
      return { className: 'inning-display live', text: inningDisplay }
    }
  }
  
  switch (game.status) {
    case 'live':
      return { className: 'inning-display live', text: timeText || 'Live' }
    case 'halftime':
      return { className: 'inning-display halftime', text: 'HALFTIME' }
    case 'final':
      if (game.sport === 'mlb') {
        return { className: 'inning-display final', text: 'FINAL' }
      }
      return { className: 'inning-display final', text: 'FINAL' }
    case 'postponed':
      return { className: 'inning-display scheduled', text: 'POSTPONED' }
    default:
      return {
        className: 'inning-display scheduled',
        text: game.displayTime || timeText || 'TBD',
      }
  }
}

function BasesVisual({ bases }) {
  if (!bases || bases === 'empty') return null
  
  const secondBase = bases === '2nd' || bases === '1st & 2nd' || bases === '2nd & 3rd' || bases === 'loaded'
  const firstBase = bases === '1st' || bases === '1st & 2nd' || bases === '1st & 3rd' || bases === 'loaded'
  const thirdBase = bases === '3rd' || bases === '1st & 3rd' || bases === '2nd & 3rd' || bases === 'loaded'
  
  return (
    <div className="bases-diamond">
      <div className={`base second-base ${secondBase ? 'occupied' : 'empty'}`}></div>
      <div className="bases-row">
        <div className={`base third-base ${thirdBase ? 'occupied' : 'empty'}`}></div>
        <div className={`base first-base ${firstBase ? 'occupied' : 'empty'}`}></div>
      </div>
    </div>
  )
}

function CountDots({ game }) {
  if (game.sport !== 'mlb') return null
  
  return (
    <div className="count-dots-container">
      {game.balls !== null && game.balls !== undefined && (
        <div className="count-dots balls-dots">
          <span className="count-label">B</span>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`count-dot ${i < game.balls ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
      {game.strikes !== null && game.strikes !== undefined && (
        <div className="count-dots strikes-dots">
          <span className="count-label">S</span>
          {[0, 1].map((i) => (
            <span key={i} className={`count-dot ${i < game.strikes ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
      {game.outs !== null && game.outs !== undefined && (
        <div className="count-dots outs-dots">
          <span className="count-label">O</span>
          {[0, 1].map((i) => (
            <span key={i} className={`count-dot ${i < game.outs ? 'active' : ''}`}>●</span>
          ))}
        </div>
      )}
    </div>
  )
}


function TeamLogo({ name, logoUrl, fallbackText }) {
  const [failed, setFailed] = useState(false)
  const fallback = fallbackText || getTeamInitials(name)

  if (!logoUrl || failed) {
    return (
      <div className="fallback-logo">
        {fallback}
      </div>
    )
  }

  return (
    <>
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'contain' }}
      />
      <div className="fallback-logo" style={{ display: 'none' }}>
        {fallback}
      </div>
    </>
  )
}


function TeamRow({ game, side }) {
  const isAway = side === 'away'
  const teamName = isAway ? game.awayTeam : game.homeTeam
  const teamShortName = isAway ? game.awayShortName : game.homeShortName
  const teamAbbreviation = isAway ? game.awayAbbreviation : game.homeAbbreviation
  const score = isAway ? game.awayScore : game.homeScore
  const record = isAway ? game.awayTeamRecord : game.homeTeamRecord
  const isWinner = getWinner(game) === side
  const scheduled = game.status === 'scheduled'
  const logoUrl = isAway ? game.awayLogo : game.homeLogo
  const displayName = teamShortName || teamName
  const fallbackText = getFallbackText(teamName, teamShortName, teamAbbreviation)

  // Check for possession/at-bat highlighting
  let hasPossession = false
  if (game.status === 'live' || game.status === 'halftime') {
    if (game.sport === 'nfl' || game.sport === 'college-football') {
      const teamId = isAway ? game.awayTeamId : game.homeTeamId
      // Compare as strings to ensure type matching
      hasPossession = game.possessionTeam && teamId && String(game.possessionTeam) === String(teamId)
      
      // Debug: Log possession check for first live game
      if (game.status === 'live' && (game.sport === 'nfl' || game.sport === 'college-football') && !window._loggedPossessionCheck) {
        window._loggedPossessionCheck = true
        console.log('=== POSSESSION CHECK DEBUG ===')
        console.log('Sport:', game.sport)
        console.log('Game possessionTeam:', game.possessionTeam, typeof game.possessionTeam)
        console.log('Team ID:', teamId, typeof teamId)
        console.log('Side:', side, 'isAway:', isAway)
        console.log('Has possession:', hasPossession)
        console.log('Comparison:', String(game.possessionTeam), '===', String(teamId))
      }
    } else if (game.sport === 'mlb') {
      hasPossession = game.atBatTeam === side
    }
  }

  const classes = ['team']
  if (isWinner && game.status === 'final') classes.push('winner')
  if (hasPossession) classes.push('possession')
  if (hasPossession && game.sport === 'mlb') classes.push('at-bat')

  // Get odds for this team
  let teamSpread = null
  let teamMoneyline = null
  if (scheduled && game.odds) {
    if (isAway) {
      teamSpread = game.odds.spread
      teamMoneyline = game.odds.awayMoneyline
    } else {
      // Home team spread is opposite of away
      teamSpread = game.odds.spread !== null ? -game.odds.spread : null
      teamMoneyline = game.odds.homeMoneyline
    }
  }

  const formatSpread = (spread) => {
    if (spread === null || spread === undefined) return null
    const num = typeof spread === 'string' ? parseFloat(spread.replace('+', '')) : spread
    if (isNaN(num)) return String(spread)
    return num > 0 ? `+${num}` : String(num)
  }

  const formatMoneyline = (ml) => {
    if (ml === null || ml === undefined) return null
    const num = typeof ml === 'string' ? parseFloat(ml.replace('+', '')) : ml
    if (isNaN(num)) return String(ml)
    return num > 0 ? `+${num}` : String(num)
  }

  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div className="team-info">
        <div className="team-logo">
          <TeamLogo name={teamName} logoUrl={logoUrl} fallbackText={fallbackText} />
        </div>
        <div className="team-details">
          <span className="team-name">
            {displayName}
            {scheduled && teamSpread !== null && (
              <span className="team-spread"> ({formatSpread(teamSpread)})</span>
            )}
            {scheduled && teamMoneyline !== null && (
              <span className="team-moneyline"> {formatMoneyline(teamMoneyline)}</span>
            )}
          </span>
          {record ? <span className="team-record">{record}</span> : null}
        </div>
      </div>
      <span className={['team-score', scheduled ? 'scheduled' : ''].join(' ')}>
        {scheduled ? '' : score}
      </span>
    </div>
  )
}

function ScoreCard({ game, onOpenSummary }) {
  const badge = getStatusBadge(game)
  const statusBadge = badge ? (
    <span className={badge.className}>{badge.text}</span>
  ) : null

  return (
    <div
      className="score-card"
      data-game-id={`${game.sport}-${game.awayTeam}-${game.homeTeam}`}
      onClick={() => onOpenSummary(game)}
    >
      <div className="game-header">
        <span className="sport-type">
          {getSportDisplayName(game.sport)}
          {game.broadcastChannel ? ` • ${abbreviateNetwork(game.broadcastChannel)}` : ''}
        </span>
        {statusBadge}
      </div>
      <div className="game-content">
        <div className="teams">
          <TeamRow game={game} side="away" />
          {game.status === 'scheduled' && game.odds?.overUnder !== null && game.odds?.overUnder !== undefined && (
            <div className="over-under-display">
              O/U: {game.odds?.overUnder}
            </div>
          )}
          <TeamRow game={game} side="home" />
        </div>
        {game.sport === 'mlb' && game.status === 'live' && (
          <div className="mlb-game-state live-game">
            <div className="mlb-bases-container">
              <BasesVisual bases={game.bases} />
            </div>
            <div className="mlb-count-container">
              <CountDots game={game} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const STATUS_ORDER = {
  live: 0,
  halftime: 1,
  scheduled: 2,
  postponed: 3,
  final: 4,
}

function compareGames(a, b) {
  const statusDiff = (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5)
  if (statusDiff !== 0) return statusDiff

  const timeA = a.fullDateTime ? new Date(a.fullDateTime).getTime() : Number.MAX_SAFE_INTEGER
  const timeB = b.fullDateTime ? new Date(b.fullDateTime).getTime() : Number.MAX_SAFE_INTEGER
  if (timeA !== timeB) return timeA - timeB

  const sportDiff = a.sport.localeCompare(b.sport)
  if (sportDiff !== 0) return sportDiff

  return a.homeTeam.localeCompare(b.homeTeam)
}

function GameSummary({ game, onBack }) {
  const [summaryData, setSummaryData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      if (!game?.id || !game?.sport) return

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchGameSummary(game.sport, game.id)
        if (!cancelled) {
          // Immediate debug - log the raw response structure
          console.log('=== SUMMARY API RESPONSE RECEIVED ===')
          console.log('Response keys:', Object.keys(data))
          console.log('Has header?', !!data.header)
          console.log('Has boxscore?', !!data.boxscore)
          if (data.header?.competitions?.[0]?.competitors) {
            data.header.competitions[0].competitors.forEach((comp, idx) => {
              console.log(`Header competitor[${idx}] has linescores:`, !!comp.linescores, comp.linescores)
            })
          }
          if (data.boxscore?.teams) {
            data.boxscore.teams.forEach((team, idx) => {
              console.log(`Boxscore team[${idx}] has linescores:`, !!team.linescores, team.linescores)
            })
          }
          if (data.boxscore?.situation) {
            console.log('Boxscore situation:', data.boxscore.situation)
            console.log('Situation keys:', Object.keys(data.boxscore.situation))
          }
          if (data.header?.competitions?.[0]?.situation) {
            console.log('Header situation:', data.header.competitions[0].situation)
            console.log('Header situation keys:', Object.keys(data.header.competitions[0].situation))
          }
          console.log('Full response structure:', JSON.stringify(data, null, 2).substring(0, 15000))
          
          setSummaryData(data)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load game summary:', err)
          setError(err.message)
          setIsLoading(false)
        }
      }
    }

    loadSummary()

    return () => {
      cancelled = true
    }
  }, [game?.id, game?.sport])

  const boxscore = summaryData?.boxscore
  const teams = boxscore?.teams || []
  // Try to match teams by ID first, then by position (away is usually first, home second)
  const awayTeam = teams.find((t) => {
    const teamId = String(t.team?.id || '')
    return teamId === String(game.awayTeamId) || 
           t.team?.displayName === game.awayTeam ||
           t.team?.name === game.awayTeam
  }) || teams[0]
  const homeTeam = teams.find((t) => {
    const teamId = String(t.team?.id || '')
    return teamId === String(game.homeTeamId) ||
           t.team?.displayName === game.homeTeam ||
           t.team?.name === game.homeTeam
  }) || teams[1] || (teams[0] === awayTeam ? null : teams[0])
  
  // Extract quarter/period scores from linescores
  // Check multiple possible locations for linescores data
  // First check header.competitions (most common ESPN API location)
  const headerCompetitors = summaryData?.header?.competitions?.[0]?.competitors || []
  const headerAwayCompetitor = headerCompetitors.find(c => 
    String(c.team?.id) === String(game.awayTeamId) || 
    c.homeAway === 'away'
  )
  const headerHomeCompetitor = headerCompetitors.find(c => 
    String(c.team?.id) === String(game.homeTeamId) || 
    c.homeAway === 'home'
  )
  
  const awayLinescores = headerAwayCompetitor?.linescores ||
                         awayTeam?.linescores || 
                         boxscore?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(awayTeam?.team?.id))?.linescores ||
                         summaryData?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(awayTeam?.team?.id))?.linescores ||
                         []
  const homeLinescores = headerHomeCompetitor?.linescores ||
                         homeTeam?.linescores || 
                         boxscore?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(homeTeam?.team?.id))?.linescores ||
                         summaryData?.linescores?.find(ls => String(ls.teamId || ls.team?.id) === String(homeTeam?.team?.id))?.linescores ||
                         []
  
  // Debug: log the structure to understand the data format
  if (summaryData && !window._loggedLinescoresDebug) {
    window._loggedLinescoresDebug = true
    console.log('=== LINESCORES DEBUG ===')
    console.log('summaryData keys:', Object.keys(summaryData))
    console.log('boxscore keys:', boxscore ? Object.keys(boxscore) : 'no boxscore')
    console.log('awayTeam keys:', awayTeam ? Object.keys(awayTeam) : 'no awayTeam')
    console.log('awayTeam.linescores:', awayTeam?.linescores)
    console.log('boxscore.linescores:', boxscore?.linescores)
    console.log('summaryData.linescores:', summaryData?.linescores)
    
    // Check header.competitions for linescores (common ESPN API location)
    const header = summaryData?.header
    console.log('header:', header)
    console.log('header.competitions:', header?.competitions)
    if (header?.competitions?.[0]?.competitors) {
      console.log('header.competitions[0].competitors:', header.competitions[0].competitors)
      header.competitions[0].competitors.forEach((comp, idx) => {
        console.log(`competitor[${idx}].linescores:`, comp.linescores)
        console.log(`competitor[${idx}].team.id:`, comp.team?.id)
        console.log(`competitor[${idx}].homeAway:`, comp.homeAway)
        if (comp.linescores) {
          console.log(`competitor[${idx}].linescores FULL:`, JSON.stringify(comp.linescores, null, 2))
        }
      })
    }
    
    // Recursively search for all "linescores" in the response
    const findAllLinescores = (obj, path = 'root') => {
      const results = []
      if (!obj || typeof obj !== 'object') return results
      
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          if (item && typeof item === 'object') {
            if ('linescores' in item) {
              results.push({ path: `${path}[${idx}].linescores`, value: item.linescores })
            }
            results.push(...findAllLinescores(item, `${path}[${idx}]`))
          }
        })
      } else {
        if ('linescores' in obj) {
          results.push({ path: `${path}.linescores`, value: obj.linescores })
        }
        Object.keys(obj).forEach(key => {
          if (obj[key] && typeof obj[key] === 'object') {
            results.push(...findAllLinescores(obj[key], `${path}.${key}`))
          }
        })
      }
      return results
    }
    
    const allLinescores = findAllLinescores(summaryData)
    console.log('=== ALL LINESCORES FOUND IN RESPONSE ===')
    if (allLinescores.length > 0) {
      allLinescores.forEach((result, idx) => {
        console.log(`Location ${idx + 1}: ${result.path}`)
        console.log(`Value:`, result.value)
        console.log(`Type:`, Array.isArray(result.value) ? 'array' : typeof result.value)
        if (Array.isArray(result.value) && result.value.length > 0) {
          console.log(`First item:`, result.value[0])
          console.log(`Full array:`, JSON.stringify(result.value, null, 2))
        }
        console.log('---')
      })
    } else {
      console.log('NO LINESCORES FOUND ANYWHERE IN RESPONSE!')
    }
    
    // Log full summaryData structure (first 10000 chars)
    console.log('Full summaryData (first 10000 chars):', JSON.stringify(summaryData, null, 2).substring(0, 10000))
  }
  
  const plays = summaryData?.plays || []
  const headlines = summaryData?.headlines || []
  const commentary = summaryData?.commentary || []
  
  // Calculate quarter scores from scoring plays if linescores aren't available
  const calculateQuarterScores = () => {
    const awayScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const homeScores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let lastAwayScore = 0
    let lastHomeScore = 0
    
    // Filter to only scoring plays and sort by period
    const scoringPlays = plays.filter(play => 
      play.scoringPlay || 
      play.type?.text?.toLowerCase().includes('touchdown') ||
      play.type?.text?.toLowerCase().includes('field goal') ||
      play.type?.text?.toLowerCase().includes('safety') ||
      play.type?.text?.toLowerCase().includes('goal') ||
      (play.awayScore !== undefined && play.homeScore !== undefined && 
       (play.awayScore !== lastAwayScore || play.homeScore !== lastHomeScore))
    )
    
    // Sort plays by period and time
    const sortedPlays = [...scoringPlays].sort((a, b) => {
      const periodA = a.period?.number || a.period || 0
      const periodB = b.period?.number || b.period || 0
      if (periodA !== periodB) return periodA - periodB
      return 0
    })
    
    sortedPlays.forEach(play => {
      // Try multiple ways to get scores from play
      const awayScore = Number(play.awayScore ?? play.score?.away ?? play.scores?.away ?? 0)
      const homeScore = Number(play.homeScore ?? play.score?.home ?? play.scores?.home ?? 0)
      
      if (!isNaN(awayScore) && !isNaN(homeScore) && (awayScore !== lastAwayScore || homeScore !== lastHomeScore)) {
        const period = play.period?.number ?? play.period ?? play.periodNumber ?? 1
        const periodNum = Number(period)
        
        if (periodNum >= 1 && periodNum <= 5) {
          const awayDiff = awayScore - lastAwayScore
          const homeDiff = homeScore - lastHomeScore
          if (awayDiff > 0) awayScores[periodNum] += awayDiff
          if (homeDiff > 0) homeScores[periodNum] += homeDiff
          lastAwayScore = awayScore
          lastHomeScore = homeScore
        }
      }
    })
    
    // Debug logging
    if (sortedPlays.length > 0 && !window._loggedQuarterCalc) {
      window._loggedQuarterCalc = true
      console.log('=== QUARTER SCORES CALCULATION ===')
      console.log('Scoring plays count:', sortedPlays.length)
      console.log('Calculated away scores:', awayScores)
      console.log('Calculated home scores:', homeScores)
      console.log('Sample play:', sortedPlays[0])
    }
    
    return { away: awayScores, home: homeScores }
  }
  
  const calculatedScores = calculateQuarterScores()
  
  // Try to get linescores from event data if not found in team data
  const eventLinescores = summaryData?.boxscore?.linescores || summaryData?.linescores || []
  const awayLinescoresFinal = awayLinescores.length > 0 ? awayLinescores : 
    (eventLinescores.find(ls => ls.teamId === awayTeam?.team?.id || ls.team?.id === awayTeam?.team?.id)?.linescores || [])
  const homeLinescoresFinal = homeLinescores.length > 0 ? homeLinescores : 
    (eventLinescores.find(ls => ls.teamId === homeTeam?.team?.id || ls.team?.id === homeTeam?.team?.id)?.linescores || [])
  
  // Helper to get score for a specific period
  const getPeriodScore = (linescores, periodNumber, teamType) => {
    // First try calculated scores from plays (more reliable if API doesn't provide linescores)
    if (calculatedScores && calculatedScores[teamType] && calculatedScores[teamType][periodNumber] > 0) {
      return String(calculatedScores[teamType][periodNumber])
    }
    
    // Then try linescores if available
    if (!linescores || linescores.length === 0) {
      return '-'
    }
    
    // If linescores is an array, try index-based access (0-based, so period 1 = index 0)
    if (Array.isArray(linescores)) {
      const scoreEntry = linescores[periodNumber - 1]
      if (scoreEntry) {
        // Handle different data structures
        if (typeof scoreEntry === 'number') {
          return String(scoreEntry)
        }
        if (typeof scoreEntry === 'object') {
          const result = scoreEntry.value || scoreEntry.displayValue || scoreEntry.score || scoreEntry.text || '-'
          if (result !== '-') return result
        } else {
          return String(scoreEntry)
        }
      }
      
      // Also try finding by period number
      const found = linescores.find(ls => {
        if (typeof ls === 'object' && ls !== null) {
          return ls.period === periodNumber || 
                 ls.period?.number === periodNumber || 
                 ls.period?.displayValue === String(periodNumber) ||
                 ls.period?.value === periodNumber
        }
        return false
      })
      if (found) {
        const result = found.value || found.displayValue || found.score || found.text || '-'
        if (result !== '-') return result
      }
    }
    
    // Fallback to calculated scores from plays
    if (calculatedScores && calculatedScores[teamType] && calculatedScores[teamType][periodNumber] > 0) {
      return String(calculatedScores[teamType][periodNumber])
    }
    
    return '-'
  }
  
  // Extract player stats and leaders
  const leaders = summaryData?.leaders || boxscore?.leaders || []
  const awayPlayers = awayTeam?.statistics?.[0]?.athletes || awayTeam?.players || []
  const homePlayers = homeTeam?.statistics?.[0]?.athletes || homeTeam?.players || []
  
  // Get top performers by category
  const getTopPlayers = (category) => {
    const categoryLeaders = leaders.find((l) => l.name === category || l.displayName === category)
    if (!categoryLeaders) return null
    
    const awayLeader = categoryLeaders.leaders?.find((l) => l.team?.id === awayTeam?.team?.id)
    const homeLeader = categoryLeaders.leaders?.find((l) => l.team?.id === homeTeam?.team?.id)
    
    return { away: awayLeader, home: homeLeader, category: categoryLeaders.displayName || categoryLeaders.name }
  }

  const parseNumericValue = (value) => {
    if (value === null || value === undefined) return NaN
    if (typeof value === 'number') return value
    const str = String(value)
    const cleaned = str.replace(/[^\d.-]/g, '')
    const num = parseFloat(cleaned)
    return Number.isNaN(num) ? NaN : num
  }

  const awayScore = Number(game.awayScore) || 0
  const homeScore = Number(game.homeScore) || 0
  const totalScore = awayScore + homeScore
  const awayPercent = totalScore > 0 ? (awayScore / totalScore) * 100 : 50
  const homePercent = totalScore > 0 ? (homeScore / totalScore) * 100 : 50

  // Get team colors and logos from boxscore data if available, otherwise use game data
  // Use more neutral colors for team stats section
  const awayTeamColor = getTeamColor(awayTeam?.team, '#e0e0e0')
  const homeTeamColor = getTeamColor(homeTeam?.team, '#e0e0e0')
  const awayTeamLogo = awayTeam?.team?.logos?.[0]?.href || awayTeam?.team?.logo || game.awayLogo
  const homeTeamLogo = homeTeam?.team?.logos?.[0]?.href || homeTeam?.team?.logo || game.homeLogo

  return (
    <div className="container">
      <button className="back-btn floating" onClick={onBack}>
        ← Back
      </button>

      <div className="game-summary-content">
        {isLoading && <div className="info">Loading game summary...</div>}
        {error && <div className="error">Error loading summary: {error}</div>}
        {summaryData && (
          <div>
            {/* Game Header */}
            <div className="game-info-header-new">
              <div className="game-header-top">
                <div className="game-time-status">
                  {game.status === 'live' && game.clock != null && game.period ? (() => {
                    // Safely convert clock to string
                    const clockStr = game.clock != null ? String(game.clock) : ''
                    let formattedClock = clockStr
                    
                    // If clock is a number (seconds), convert to MM:SS
                    const clockNum = Number(game.clock)
                    if (!isNaN(clockNum) && typeof clockStr === 'string' && clockStr.indexOf(':') === -1) {
                      const totalSeconds = Math.abs(clockNum)
                      const minutes = Math.floor(totalSeconds / 60)
                      const seconds = totalSeconds % 60
                      formattedClock = `${minutes}:${String(seconds).padStart(2, '0')}`
                    }
                    
                    const periodText = game.period === 1 ? '1st' : game.period === 2 ? '2nd' : game.period === 3 ? '3rd' : game.period === 4 ? '4th' : game.period ? `${game.period}th` : ''
                    return (
                      <span className="game-clock">
                        {formattedClock} - {periodText}
                      </span>
                    )
                  })() : game.status === 'live' ? (
                    <span className="game-status-live">LIVE</span>
                  ) : game.status === 'final' ? (
                    <span className="game-status-final">FINAL</span>
                  ) : game.displayTime ? (
                    <span className="game-status-scheduled">{game.displayTime}</span>
                  ) : (
                    <span className="game-status-scheduled">SCHEDULED</span>
                  )}
                </div>
              </div>
              <div className="game-teams-header-new">
                {/* Away Team - Left Side */}
                <div className="team-header-new team-away">
                  <div className="team-logo-side">
                    <TeamLogo 
                      name={game.awayTeam} 
                      logoUrl={awayTeamLogo} 
                      fallbackText={getFallbackText(game.awayTeam, game.awayShortName, game.awayAbbreviation)} 
                    />
                  </div>
                  <div className="team-info-side">
                    <div className="team-name-side" style={{ color: awayTeamColor }}>{game.awayTeam}</div>
                    <div className="team-record-side">{game.awayTeamRecord || ''}</div>
                  </div>
                  <div className="team-score-side" style={{ color: awayTeamColor }}>{game.awayScore || '-'}</div>
                </div>

                {/* Center - Score Breakdown */}
                <div className="game-center-section">
                  <div className="quarter-scores-table">
                    <table className="quarter-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>1</th>
                          <th>2</th>
                          <th>3</th>
                          <th>4</th>
                          {game.sport === 'nfl' && <th>OT</th>}
                          <th>T</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="team-abbr">{game.awayAbbreviation || game.awayShortName || 'AWY'}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 1, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 2, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 3, 'away')}</td>
                          <td>{getPeriodScore(awayLinescoresFinal, 4, 'away')}</td>
                          {game.sport === 'nfl' && <td>{getPeriodScore(awayLinescoresFinal, 5, 'away') || '-'}</td>}
                          <td className="total-score">{game.awayScore || '0'}</td>
                        </tr>
                        <tr>
                          <td className="team-abbr">{game.homeAbbreviation || game.homeShortName || 'HME'}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 1, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 2, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 3, 'home')}</td>
                          <td>{getPeriodScore(homeLinescoresFinal, 4, 'home')}</td>
                          {game.sport === 'nfl' && <td>{getPeriodScore(homeLinescoresFinal, 5, 'home') || '-'}</td>}
                          <td className="total-score">{game.homeScore || '0'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {game.broadcastChannel && (
                    <div className="broadcast-info">{abbreviateNetwork(game.broadcastChannel)}</div>
                  )}
                </div>

                {/* Home Team - Right Side */}
                <div className="team-header-new team-home">
                  <div className="team-score-side" style={{ color: homeTeamColor }}>{game.homeScore || '-'}</div>
                  <div className="team-info-side">
                    <div className="team-name-side" style={{ color: homeTeamColor }}>{game.homeTeam}</div>
                    <div className="team-record-side">{game.homeTeamRecord || ''}</div>
                  </div>
                  <div className="team-logo-side">
                    <TeamLogo 
                      name={game.homeTeam} 
                      logoUrl={homeTeamLogo} 
                      fallbackText={getFallbackText(game.homeTeam, game.homeShortName, game.homeAbbreviation)} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Team Stats */}
            {boxscore && awayTeam && homeTeam && (
              <div className="boxscore-container">
                <table className="boxscore-table">
                  <thead>
                    <tr>
                      <th colSpan={3} className="boxscore-title-header">
                        <div className="boxscore-title">Team Stats</div>
                        <div className="boxscore-header-teams-unified">
                          <div className="boxscore-header-team-unified">
                            <div className="boxscore-header-logo">
                              <TeamLogo 
                                name={awayTeam.team?.displayName || awayTeam.team?.name || game.awayTeam} 
                                logoUrl={awayTeamLogo} 
                                fallbackText={getFallbackText(game.awayTeam, game.awayShortName, game.awayAbbreviation)} 
                              />
                            </div>
                            <span className="boxscore-header-away" style={{ color: awayTeamColor }}>
                              {awayTeam.team?.displayName || awayTeam.team?.name || game.awayTeam}
                            </span>
                          </div>
                          <div className="boxscore-header-team-unified">
                            <div className="boxscore-header-logo">
                              <TeamLogo 
                                name={homeTeam.team?.displayName || homeTeam.team?.name || game.homeTeam} 
                                logoUrl={homeTeamLogo} 
                                fallbackText={getFallbackText(game.homeTeam, game.homeShortName, game.homeAbbreviation)} 
                              />
                            </div>
                            <span className="boxscore-header-home" style={{ color: homeTeamColor }}>
                              {homeTeam.team?.displayName || homeTeam.team?.name || game.homeTeam}
                            </span>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                    <tbody>
                      {awayTeam.statistics && homeTeam.statistics && awayTeam.statistics.map((stat, idx) => {
                        const homeStat = homeTeam.statistics[idx]
                        if (!stat || !homeStat) return null
                        const awayDisplay = stat.displayValue || stat.value || '-'
                        const homeDisplay = homeStat.displayValue || homeStat.value || '-'
                        const awayVal = parseNumericValue(stat.displayValue ?? stat.value)
                        const homeVal = parseNumericValue(homeStat.displayValue ?? homeStat.value)
                        const total = (Number.isNaN(awayVal) ? 0 : awayVal) + (Number.isNaN(homeVal) ? 0 : homeVal)
                        const awayPercent = total > 0 ? ((Number.isNaN(awayVal) ? 0 : awayVal) / total) * 100 : 50
                        const homePercent = total > 0 ? ((Number.isNaN(homeVal) ? 0 : homeVal) / total) * 100 : 50
                        const awayColor = getTeamColor(awayTeam?.team, '#e0e0e0')
                        const homeColor = getTeamColor(homeTeam?.team, '#e0e0e0')
                        // Convert hex to rgba for gradient
                        const awayColorLight = hexToRgba(awayColor, 0.6)
                        const awayColorDark = hexToRgba(awayColor, 0.9)
                        const homeColorLight = hexToRgba(homeColor, 0.6)
                        const homeColorDark = hexToRgba(homeColor, 0.9)
                        return (
                          <tr key={idx}>
                            <td className="stat-label">{stat.label || stat.name}</td>
                            <td colSpan={2} className="boxscore-bar-cell">
                              <div className="boxscore-row-with-values">
                                <span className="boxscore-value away" style={{ color: awayColor }}>{awayDisplay}</span>
                                <div className="boxscore-row-bar">
                                  <div
                                    className="boxscore-row-bar-segment away"
                                    style={{ 
                                      width: `${awayPercent}%`,
                                      background: `linear-gradient(90deg, ${awayColorDark}, ${awayColorLight})`
                                    }}
                                  />
                                  <div
                                    className="boxscore-row-bar-segment home"
                                    style={{ 
                                      width: `${homePercent}%`,
                                      background: `linear-gradient(90deg, ${homeColorDark}, ${homeColorLight})`
                                    }}
                                  />
                                </div>
                                <span className="boxscore-value home" style={{ color: homeColor }}>{homeDisplay}</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
            )}

            {/* Top Player Stats */}
            {leaders.length > 0 && (
              <div className="summary-section">
                <h3>Top Performers</h3>
                <div className="leaders-grid">
                  {leaders.slice(0, 6).map((leader, idx) => {
                    const topLeaders = leader.leaders || []
                    if (topLeaders.length === 0) return null
                    
                    return (
                      <div key={idx} className="leader-category">
                        <div className="leader-category-name">
                          {leader.displayName || leader.name || 'Stat'}
                        </div>
                        <div className="leader-players">
                          {topLeaders.slice(0, 3).map((player, pIdx) => (
                            <div key={pIdx} className="leader-player">
                              <div className="leader-player-name">
                                {player.athlete?.displayName || player.athlete?.fullName || player.displayName || 'Player'}
                              </div>
                              <div className="leader-player-stat">
                                {player.displayValue || player.value || '-'}
                              </div>
                              <div className="leader-player-team">
                                {player.team?.displayName || player.team?.abbreviation || ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Scoring Plays */}
            {plays.length > 0 && (
              <div className="summary-section">
                <h3>Scoring Plays</h3>
                <div className="plays-list">
                  {plays
                    .filter((play) => play.scoringPlay || play.type?.text?.includes('Touchdown') || play.type?.text?.includes('Goal'))
                    .slice(-10)
                    .reverse()
                    .map((play, idx) => (
                      <div key={idx} className="play-item">
                        <div className="play-period">
                          {play.period?.displayName || play.period?.number || play.period || '-'}
                        </div>
                        <div className="play-text">
                          {play.text || play.shortText || play.type?.text || play.description || 'Play'}
                        </div>
                        <div className="play-score">
                          {play.awayScore !== undefined && play.homeScore !== undefined
                            ? `${play.awayScore} - ${play.homeScore}`
                            : play.scoreValue || ''}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Game Notes/Commentary */}
            {commentary.length > 0 && (
              <div className="summary-section">
                <h3>Game Notes</h3>
                <div className="game-notes">
                  {commentary.slice(-5).reverse().map((note, idx) => (
                    <div key={idx} className="note-item">
                      <div className="note-time">{note.time}</div>
                      <div className="note-text">{note.text || note.headline}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Headlines */}
            {headlines.length > 0 && (
              <div className="summary-section">
                <h3>Related News</h3>
                <div className="headlines">
                  {headlines.map((headline, idx) => (
                    <div key={idx} className="headline-item">
                      <a
                        href={headline.links?.web?.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="headline-link"
                      >
                        {headline.description || headline.shortLinkText || headline.headline}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const today = useMemo(() => stripTime(new Date()), [])
  const baseMonday = useMemo(() => getMonday(today), [today])
  const todayKey = useMemo(() => getDayKeyFromDate(today), [today])

  const [weekOffset, setWeekOffset] = useState(0)
  const [activeDay, setActiveDay] = useState(todayKey === 'sunday' ? 'sunday' : todayKey)
  const [currentDate, setCurrentDate] = useState(() => new Date(today))
  const [selectedSport, setSelectedSport] = useState('all')
  const [selectedGame, setSelectedGame] = useState(null)

  const { scores, isLoading, error } = useScores(currentDate)

  const dateInputRef = useRef(null)

  const dayDates = useMemo(() => {
    const monday = addDays(baseMonday, weekOffset * 7)
    const map = {}
    DAY_KEYS.forEach((key, index) => {
      map[key] = addDays(monday, index)
    })
    // Sunday should be six days from Monday
    map.sunday = addDays(monday, 6)
    return map
  }, [baseMonday, weekOffset])

  const handleSportClick = (sport) => {
    setSelectedSport(sport)
  }

  const handleDaySelect = (dayKey) => {
    const targetDate = dayDates[dayKey]
    if (!targetDate) return
    setActiveDay(dayKey)
    setCurrentDate(targetDate)
  }

  const goToWeek = (newOffset) => {
    const monday = addDays(baseMonday, newOffset * 7)
    const defaultDay = newOffset === 0 ? todayKey : 'monday'
    const newActiveDay = DAY_KEYS.includes(defaultDay) ? defaultDay : 'monday'
    const dayIndex = newActiveDay === 'sunday' ? 6 : DAY_KEYS.indexOf(newActiveDay)
    const newDate = addDays(monday, dayIndex)
    setWeekOffset(newOffset)
    setActiveDay(newActiveDay)
    setCurrentDate(newDate)
  }

  const handlePreviousWeek = () => {
    goToWeek(weekOffset - 1)
  }

  const handleNextWeek = () => {
    goToWeek(weekOffset + 1)
  }

  const handleCustomDateChange = (event) => {
    const value = event.target.value
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    const selected = new Date(year, month - 1, day)
    const selectedMonday = getMonday(selected)
    const diffWeeks = Math.round((stripTime(selectedMonday) - baseMonday) / MILLISECONDS_IN_DAY / 7)
    setWeekOffset(diffWeeks)
    const newActiveDay = getDayKeyFromDate(selected)
    setActiveDay(DAY_KEYS.includes(newActiveDay) ? newActiveDay : 'monday')
    setCurrentDate(selected)
  }

  const toggleDatePicker = () => {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker()
    } else {
      dateInputRef.current?.click()
    }
  }

  const handleOpenGameSummary = (game) => {
    setSelectedGame(game)
  }

  const handleBackToScores = () => {
    setSelectedGame(null)
  }

  const weekLabel = formatWeekLabel(weekOffset)

  const sortedScores = useMemo(() => {
    let baseScores =
      selectedSport === 'all'
        ? scores
        : scores.filter((game) => game.sport === selectedSport)
    
    
    const copy = [...baseScores]
    copy.sort(compareGames)
    return copy
  }, [scores, selectedSport])


  const liveCount = useMemo(
    () => sortedScores.filter((game) => game.status === 'live' || game.status === 'halftime').length,
    [sortedScores],
  )

  // Show game summary if a game is selected
  if (selectedGame) {
    return <GameSummary game={selectedGame} onBack={handleBackToScores} />
  }

  return (
    <div className="container">
      <div className="site-header">
        <div className="header-left">
          <img src="helmet logo.png" alt="Quiet Scores Logo" className="site-logo" />
          <h1>Quiet Scores - Live ESPN Data</h1>
        </div>
        <div
          className="live-games-indicator"
          style={{ display: liveCount > 0 ? 'flex' : 'none' }}
        >
          <span className="count" id="liveGamesCount">
            {liveCount}
          </span>
          <span>Live Games</span>
        </div>
      </div>

      <div className="date-navigation">
        <div className="week-display" onClick={toggleDatePicker} style={{ cursor: 'pointer' }}>
          <div className="week-label" id="weekLabel">
            {weekLabel}
          </div>
        </div>

        <div className="week-buttons">
          <button className="week-nav-btn" onClick={handlePreviousWeek}>
            ◀
          </button>
          {DAY_KEYS.map((dayKey) => (
            <div className="day-button" key={dayKey}>
              <button
                className={['week-btn', activeDay === dayKey ? 'active' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleDaySelect(dayKey)}
              >
                {dayKey.slice(0, 3).charAt(0).toUpperCase() + dayKey.slice(1, 3)}
              </button>
              <div className="day-date" id={`${dayKey}Date`}>
                {formatDateLabel(dayDates[dayKey])}
              </div>
            </div>
          ))}
          <button className="week-nav-btn" onClick={handleNextWeek}>
            ▶
          </button>
        </div>

        <div className="date-picker" id="datePicker">
          <input
            ref={dateInputRef}
            type="date"
            id="customDate"
            value={formatDateInputValue(currentDate)}
            onChange={handleCustomDateChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div className="controls">
        <div className="sport-filters">
          {SPORT_BUTTONS.map((button) => (
            <button
              key={button.value}
              className={['sport-btn', selectedSport === button.value ? 'active' : '']
                .filter(Boolean)
                .join(' ')}
              data-sport={button.value}
              onClick={() => handleSportClick(button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scores-container" id="scoresContainer">
        {error ? (
          <div className="error">Unable to load scores. Please try again.</div>
        ) : sortedScores.length === 0 ? (
          <div className="info">
            {isLoading ? 'Loading scores…' : 'No games scheduled for this date.'}
          </div>
        ) : (
          sortedScores.map((game) => (
            <ScoreCard
              key={game.id ?? `${game.sport}-${game.awayTeam}-${game.homeTeam}`}
              game={game}
              onOpenSummary={handleOpenGameSummary}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default App
