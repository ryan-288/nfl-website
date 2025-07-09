"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ChevronDown } from "lucide-react"
import Image from "next/image"

export default function NFLDecisionCalculator() {
  const [selectedLeague, setSelectedLeague] = useState("NFL")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [yardline, setYardline] = useState(50)
  const [yardsToGo, setYardsToGo] = useState([10])
  const [timeRemaining, setTimeRemaining] = useState("0:00")
  const [scoreDiff, setScoreDiff] = useState(1)
  const [quarter, setQuarter] = useState("4th")
  const [kickerRange, setKickerRange] = useState([50])
  const [punterRange, setPunterRange] = useState([45])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCalculate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("http://localhost:5000/api/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          yardline,
          yardsToGo: yardsToGo[0],
          quarter,
          timeRemaining,
          scoreDiff,
          kickerRange: kickerRange[0],
          punterRange: punterRange[0],
          teamSide: "opponent", // You can make this configurable
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to calculate")
      }

      const calculationResults = await response.json()
      setResults(calculationResults)
    } catch (err) {
      setError(`Calculation error: ${err.message}`)
      console.error("Calculation error:", err)
    } finally {
      setLoading(false)
    }
  }

  const getLeagueIcon = () => {
    switch (selectedLeague) {
      case "NFL":
        return <Image src="/nfl-logo.png" alt="NFL Logo" width={24} height={24} className="object-contain" />
      case "College":
        return <Image src="/ncaa-logo.png" alt="NCAA Logo" width={24} height={24} className="object-contain" />
      case "High School":
        return <Image src="/football-icon.png" alt="Football" width={24} height={24} className="object-contain" />
      default:
        return (
          <div className="w-6 h-6 border border-white rounded flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-sm"></div>
          </div>
        )
    }
  }

  const getDropdownIcon = (league: string) => {
    switch (league) {
      case "NFL":
        return <Image src="/nfl-logo.png" alt="NFL Logo" width={20} height={20} className="object-contain" />
      case "College":
        return <Image src="/ncaa-logo.png" alt="NCAA Logo" width={20} height={20} className="object-contain" />
      case "High School":
        return <Image src="/football-icon.png" alt="Football" width={20} height={20} className="object-contain" />
      default:
        return null
    }
  }

  const SmallPieChart = ({ percentage }: { percentage: number }) => {
    const size = 80
    const radius = 30
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (Math.abs(percentage) / 100) * circumference

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="6"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-blue-600">
            {percentage >= 0 ? "+" : ""}
            {percentage}%
          </span>
        </div>
      </div>
    )
  }

  // Use placeholder data if no results yet
  const displayResults = results || {
    go: { tdProb: 25.8, fgProb: -0.2, noScoreProb: -24.8, wpa: 6.7 },
    fg: { tdProb: -13.6, fgProb: 32.2, noScoreProb: -18.4, wpa: 1.6 },
    punt: { netTdProb: -21.8, scoreProb: 3.7, winProb: 2.5 },
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* League Header with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full bg-slate-800 text-white p-4 rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {getLeagueIcon()}
                  <span className="text-lg font-semibold">{selectedLeague}</span>
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                  {["NFL", "College", "High School"].map((league) => (
                    <button
                      key={league}
                      onClick={() => {
                        setSelectedLeague(league)
                        setDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-3"
                    >
                      <div className="text-gray-600">{getDropdownIcon(league)}</div>
                      {league}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current Yardline */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Current Yardline</Label>
              <Input
                type="number"
                value={yardline}
                onChange={(e) => setYardline(Number(e.target.value))}
                className="text-center text-2xl font-bold h-12 border-gray-300"
                min={1}
                max={99}
              />
            </div>

            {/* Yards To Go */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm text-gray-600">Yards To Go</Label>
                <span className="text-2xl font-bold">{yardsToGo[0]}</span>
              </div>
              <Slider value={yardsToGo} onValueChange={setYardsToGo} max={20} min={1} step={1} className="mt-2" />
            </div>

            {/* Time Remaining */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Time Remaining</Label>
              <Input
                type="text"
                value={timeRemaining}
                onChange={(e) => setTimeRemaining(e.target.value)}
                className="text-center text-2xl font-bold h-12 border-gray-300"
                placeholder="0:00"
              />
            </div>

            {/* Score Diff */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Score Diff</Label>
              <Input
                type="number"
                value={scoreDiff}
                onChange={(e) => setScoreDiff(Number(e.target.value))}
                className="text-center text-2xl font-bold h-12 border-gray-300"
              />
            </div>

            {/* Quarter Selection */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Quarter</Label>
              <div className="flex gap-2">
                {["1st", "2nd", "3rd", "4th"].map((quarterOption) => (
                  <button
                    key={quarterOption}
                    onClick={() => setQuarter(quarterOption)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium ${
                      quarter === quarterOption
                        ? "bg-slate-800 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {quarterOption}
                  </button>
                ))}
              </div>
            </div>

            {/* Kicker Range */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Kicker Range: {kickerRange[0]} yards</Label>
              <div className="relative">
                <Slider
                  value={kickerRange}
                  onValueChange={setKickerRange}
                  max={65}
                  min={25}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>25</span>
                  <span>45</span>
                  <span>65</span>
                </div>
              </div>
            </div>

            {/* Punter Range */}
            <div>
              <Label className="text-sm text-gray-600 mb-2 block">Punter Range: {punterRange[0]} yards</Label>
              <div className="relative">
                <Slider
                  value={punterRange}
                  onValueChange={setPunterRange}
                  max={65}
                  min={25}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>25</span>
                  <span>45</span>
                  <span>65</span>
                </div>
              </div>
            </div>

            {/* Calculate Button */}
            <Button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full py-4 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? "CALCULATING..." : "CALCULATE"}
            </Button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {/* Go Section */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">Go</h3>
                  <div className="text-sm text-gray-500 mb-3">EPAs × Success% - EPAf = WPA</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Δ TD prob.:</span>
                      <span className="font-medium">+{displayResults.go.tdProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ FG prob.:</span>
                      <span className="font-medium">{displayResults.go.fgProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ No score prob.:</span>
                      <span className="font-medium">{displayResults.go.noScoreProb}%</span>
                    </div>
                  </div>
                </div>
                <SmallPieChart percentage={displayResults.go.wpa} />
              </div>
              <hr className="border-gray-200" />
            </div>

            {/* FG Section */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">FG</h3>
                  <div className="text-sm text-gray-500 mb-3">EPAs × Success% - EPAf = WPA</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Δ TD prob.:</span>
                      <span className="font-medium">{displayResults.fg.tdProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ FG prob.:</span>
                      <span className="font-medium">+{displayResults.fg.fgProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ No score prob.:</span>
                      <span className="font-medium">{displayResults.fg.noScoreProb}%</span>
                    </div>
                  </div>
                </div>
                <SmallPieChart percentage={displayResults.fg.wpa} />
              </div>
              <hr className="border-gray-200" />
            </div>

            {/* Punt Section */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3">Punt</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Δ netTD%</span>
                      <span className="font-medium">{displayResults.punt.netTdProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ Score%:</span>
                      <span className="font-medium">+{displayResults.punt.scoreProb}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Δ Win%:</span>
                      <span className="font-medium">+{displayResults.punt.winProb}%</span>
                    </div>
                  </div>
                </div>
                <SmallPieChart percentage={displayResults.punt.winProb} />
              </div>
              <hr className="border-gray-200" />
            </div>

            {/* Recommendation */}
            <div>
              <h3 className="text-xl font-bold mb-4">Recommendation</h3>
              <div className="border-2 border-green-500 rounded-lg p-6 text-center bg-green-50">
                <div className="text-3xl font-bold mb-2">{results ? "Calculated" : "Go"}</div>
                <div className="text-lg font-medium text-green-700">+{displayResults.go.wpa}% WPA</div>
                <div className="text-lg font-medium text-green-700">+7.6% Δ Win%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
