package main

import "math"

// Helper: total production for a producer line given base rate and owned count
// Each additional unit modestly increases the line's throughput multiplicatively
// effective = owned * baseRate * (effGrowth)^(owned-1)
func lineProduction(baseRate int, owned int) int {
    if owned <= 0 || baseRate <= 0 {
        return 0
    }
    effGrowth := 1.10 // 10% more line efficiency per additional unit
    prod := float64(owned) * float64(baseRate) * math.Pow(effGrowth, float64(owned-1))
    return int(math.Floor(prod))
}

// Helper: price scaling for producers
func calculateProducerCost(baseCost int, owned int) int {
    return int(float64(baseCost) * math.Pow(1.5, float64(owned)))
}

// Helper function to calculate next power level
func calculateNextPower(currentPower int) int {
    if currentPower < 1 {
        return 1
    }
    // Gentle multiplicative growth with minimum +1 step
    // Target ~15% per level to avoid explosive prices while keeping upgrades meaningful
    next := int(math.Floor(float64(currentPower)*1.10))
    if next <= currentPower {
        next = currentPower + 1
    }
    return next
}

// Round helper to keep prices clean
func roundToNearest(x, base int) int {
    if base <= 0 {
        return x
    }
    r := int(math.Round(float64(x) / float64(base)))
    return r * base
}

// Helper function to calculate next power price based on current power
// Uses a proportional payback model: price ~= paybackClicks * (gain per tap)
func calculateNextPowerPrice(currentPower int) int {
    nextPower := calculateNextPower(currentPower)
    delta := nextPower - currentPower
    if delta < 1 {
        delta = 1
    }
    // Target payback in clicks keeps upgrades fair and smooth
    const paybackClicks = 200
    const base = 10
    price := base + paybackClicks*delta
    // Round to nicer numbers
    return roundToNearest(price, 10)
}

// Helper function to calculate build time based on price (0-172800 seconds)
func calculateBuildTime(price int) int {
    // Scale build time based on price: 0-172800 seconds (48 hours)
    // Higher price = much longer build time
    // Items under 1000000 have instant build time
    var buildTime int
    
    if price < 100000 {
        // Items under 1000000: 0 seconds (instant)
        buildTime = 0
    } else {
        // Items 1000000+: 1 second to 48 hours based on price
        // Scale from 1s to 172800s (48h) for items 1M to 1T+
        minTime := 1
        maxTime := 172800 // 48 hours
        minPrice := 1000000
        maxPrice := 500_000_000  
        
        // Clamp price to maxPrice to prevent overflow
        if price > maxPrice {
            price = maxPrice
        }
        
        // Linear scaling from minTime to maxTime
        buildTime = minTime + int(float64(price-minPrice)/float64(maxPrice-minPrice)*float64(maxTime-minTime))
        
        // Ensure we don't exceed max time
        if buildTime > maxTime {
            buildTime = maxTime
        }
    }
    
    return buildTime
}
