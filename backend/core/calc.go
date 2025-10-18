package core

import "math"

// LineProduction: total production for a producer line given base rate and owned count
// Each additional unit modestly increases the line's throughput multiplicatively
// effective = owned * baseRate * (effGrowth)^(owned-1)
func LineProduction(baseRate int, owned int) int {
    if owned <= 0 || baseRate <= 0 {
        return 0
    }
    effGrowth := 1.10 // 10% more line efficiency per additional unit
    prod := float64(owned) * float64(baseRate) * math.Pow(effGrowth, float64(owned-1))
    return int(math.Floor(prod))
}

// CalculateProducerCost: price scaling for producers
func CalculateProducerCost(baseCost int, owned int) int {
    return int(float64(baseCost) * math.Pow(1.5, float64(owned)))
}

// CalculateNextPower calculates next power level
func CalculateNextPower(currentPower int) int {
    if currentPower < 1 {
        return 1
    }
    next := int(math.Floor(float64(currentPower)*1.10))
    if next <= currentPower {
        next = currentPower + 1
    }
    return next
}

// RoundToNearest rounds to nearest base
func RoundToNearest(x, base int) int {
    if base <= 0 {
        return x
    }
    r := int(math.Round(float64(x) / float64(base)))
    return r * base
}

// CalculateNextPowerPrice computes next power price based on current power
func CalculateNextPowerPrice(currentPower int) int {
    nextPower := CalculateNextPower(currentPower)
    delta := nextPower - currentPower
    if delta < 1 {
        delta = 1
    }
    price := RoundBase + PaybackClicks*delta
    return RoundToNearest(price, RoundBase)
}

// CalculateBuildTime computes build time based on price (0-172800 seconds)
func CalculateBuildTime(price int) int {
    var buildTime int
    if price < BuildTimeInstantThreshold {
        buildTime = 0
    } else {
        minTime := 1
        maxTime := BuildTimeMaxSeconds
        minPrice := BuildTimeMinPrice
        maxPrice := BuildTimeMaxPrice
        if price > maxPrice {
            price = maxPrice
        }
        buildTime = minTime + int(float64(price-minPrice)/float64(maxPrice-minPrice)*float64(maxTime-minTime))
        if buildTime > maxTime {
            buildTime = maxTime
        }
    }
    return buildTime
}
