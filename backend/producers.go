package main

// Producer represents a production line in the game
// It is referenced by handlers like `handleGetProducers()` and `handleBuyProducer()`.
type Producer struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Cost         int    `json:"cost"`
	Rate         int    `json:"rate"`
	Owned        int    `json:"owned"`
	Emoji        string `json:"emoji"`
	BuildTime    int    `json:"build_time"`
	IsBuilding   bool   `json:"is_building"`
	BuildTimeLeft int64 `json:"build_time_left"`
}

// Neon Sign Production Supply Chain - From raw materials to global distribution
var defaultProducers = []Producer{
	// Phase 1: Raw Material Extraction (1-20/sec)
	{ID: 1, Name: "Glass Quarry", Cost: 15, Rate: 1, Owned: 0, Emoji: "🏔️"},
	{ID: 2, Name: "Gas Extractor", Cost: 35, Rate: 2, Owned: 0, Emoji: "⛽"},
	{ID: 3, Name: "Metal Mine", Cost: 70, Rate: 3, Owned: 0, Emoji: "⛏️"},

	// Phase 2: Tube Manufacturing (20-100/sec)
	{ID: 4, Name: "Glass Blower", Cost: 150, Rate: 4, Owned: 0, Emoji: "🔥"},
	{ID: 5, Name: "Tube Bender", Cost: 300, Rate: 5, Owned: 0, Emoji: "🔧"},
	{ID: 6, Name: "Electrode Installer", Cost: 800, Rate: 10, Owned: 0, Emoji: "⚡"},

	// Phase 3: LED Sign Production (100-500/sec)
	{ID: 7, Name: "LED Factory", Cost: 1200, Rate: 15, Owned: 0, Emoji: "💡"},
	{ID: 8, Name: "Circuit Printer", Cost: 2400, Rate: 20, Owned: 0, Emoji: "🔌"},
	{ID: 9, Name: "Sign Assembler", Cost: 4800, Rate: 30, Owned: 0, Emoji: "🔨"},

	// Phase 4: Neon Sign Crafting (500-1500/sec)
	{ID: 10, Name: "Neon Bender", Cost: 9000, Rate: 50, Owned: 0, Emoji: "🌈"},
	{ID: 11, Name: "Gas Filler", Cost: 18000, Rate: 70, Owned: 0, Emoji: "💨"},
	{ID: 12, Name: "Quality Tester", Cost: 36000, Rate: 100, Owned: 0, Emoji: "🔍"},

	// Phase 5: Global Distribution (1500-5000/sec)
	{ID: 13, Name: "Shipping Container", Cost: 144000, Rate: 150, Owned: 0, Emoji: "📦"},
	{ID: 14, Name: "Cargo Ship", Cost: 288000, Rate: 200, Owned: 0, Emoji: "🚢"},
	{ID: 15, Name: "Global Neon Empire", Cost: 512000, Rate: 250, Owned: 0, Emoji: "🌍"},

	// Phase 6: Mega Production (5000-15000/sec)
	{ID: 16, Name: "Neon Megafactory", Cost: 1000000, Rate: 300, Owned: 0, Emoji: "🏭"},
	{ID: 17, Name: "Quantum Assembly Line", Cost: 5000000, Rate: 400, Owned: 0, Emoji: "⚛️"},
	{ID: 18, Name: "Plasma Processing Plant", Cost: 10000000, Rate: 500, Owned: 0, Emoji: "💥"},

	// Phase 7: Ultra Production (15000-50000/sec)
	{ID: 19, Name: "Neon Overdrive Complex", Cost: 50000000, Rate: 700, Owned: 0, Emoji: "🚀"},
	{ID: 20, Name: "Cosmic Manufacturing Hub", Cost: 100000000, Rate: 900, Owned: 0, Emoji: "🌌"},
	{ID: 21, Name: "Galactic Neon Station", Cost: 500000000, Rate: 1000, Owned: 0, Emoji: "🛸"},
}
