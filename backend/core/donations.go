package core

// DonationGoal defines a global donation target for the community
// Used by handlers like ListDonationGoals and GetDonationGoal
type DonationGoal struct {
    ID     int    `json:"id"`
    Name   string `json:"name"`
    Target int64  `json:"target"`
}

// DonationGoals is the list of global donation targets
var DonationGoals = []DonationGoal{
    {ID: 1, Name: "Pay US Debt", Target: 32000000000000},
    {ID: 2, Name: "Cleanup Oceans", Target: 92000000000000},
    {ID: 3, Name: "End Global Hunger", Target: 350000000000000},
    {ID: 4, Name: "Terraform Mars", Target: 1500000000000000},
    {ID: 5, Name: "Build Dyson Sphere", Target: 5000000000000000},
    {ID: 6, Name: "Interstellar Highway", Target: 12000000000000000},
}
