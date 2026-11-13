using AstroHealth.Domain.Vitals;

namespace AstroHealth.Domain.Hazards;

public sealed record PlaybookEntry(string Key, string Title, SpaceHazard Hazard, string HrpRisk, IReadOnlyList<string> Steps);

/// <summary>
/// Onboard first-response checklists, one per alert type. With minutes of signal delay to Earth
/// (the "distance from Earth" hazard) a crew cannot wait for the ground before acting, so every
/// alert carries the immediate steps the crew can take on its own. Illustrative only: not medical
/// or flight procedures.
/// </summary>
public static class CrewActionPlaybook
{
    public static readonly IReadOnlyList<PlaybookEntry> Entries =
    [
        new(nameof(VitalMetric.HeartRate), "Abnormal heart rate", SpaceHazard.GravityFields, "Cardiovascular adaptations",
        [
            "Stop strenuous activity and have the crew member rest seated or restrained.",
            "Re-measure heart rate after 5 minutes of rest.",
            "Record an ECG with the onboard monitor if the rate stays abnormal.",
            "Check hydration and recent exercise or EVA activity.",
            "Notify the flight surgeon with the ECG and vitals trend."
        ]),
        new(nameof(VitalMetric.SystolicPressure), "Abnormal blood pressure", SpaceHazard.GravityFields, "Cardiovascular adaptations",
        [
            "Rest for 10 minutes, then repeat the blood pressure measurement.",
            "Ask about headache, vision changes or dizziness.",
            "Review fluid intake and medication log.",
            "Notify the flight surgeon if the second reading is still out of range."
        ]),
        new(nameof(VitalMetric.DiastolicPressure), "Abnormal blood pressure", SpaceHazard.GravityFields, "Cardiovascular adaptations",
        [
            "Rest for 10 minutes, then repeat the blood pressure measurement.",
            "Ask about headache, vision changes or dizziness.",
            "Notify the flight surgeon if the second reading is still out of range."
        ]),
        new(nameof(VitalMetric.OxygenSaturation), "Low oxygen saturation", SpaceHazard.HostileClosedEnvironments, "Hypoxia",
        [
            "Check the cabin oxygen and CO₂ readings on the Hazards page.",
            "Move the crew member to a well-ventilated module.",
            "Provide supplemental oxygen from the medical kit.",
            "Re-check SpO₂ after 2 minutes on oxygen.",
            "Notify the flight surgeon; prepare for emergency procedures if SpO₂ keeps falling."
        ]),
        new(nameof(VitalMetric.BodyTemperature), "Abnormal body temperature", SpaceHazard.HostileClosedEnvironments, "Altered immune system responses",
        [
            "Confirm with a second thermometer reading.",
            "Check cabin temperature and the crew member's recent workload.",
            "Look for signs of infection; isolate if a contagious illness is suspected.",
            "Start fluids and rest; notify the flight surgeon."
        ]),
        new(nameof(VitalMetric.RespiratoryRate), "Abnormal breathing rate", SpaceHazard.HostileClosedEnvironments, "Hypoxia",
        [
            "Check cabin CO₂ first: high CO₂ raises breathing rate for everyone aboard.",
            "Rest the crew member and re-measure after 5 minutes.",
            "Check SpO₂ at the same time.",
            "Notify the flight surgeon if the rate stays abnormal."
        ]),
        new(nameof(VitalMetric.RadiationDose), "Elevated radiation", SpaceHazard.SpaceRadiation, "Radiation-induced cancer",
        [
            "Move all crew to the designated storm shelter.",
            "Postpone or terminate any spacewalk.",
            "Keep personal dosimeters on and log the start time.",
            "Stay sheltered until the dose rate returns below the warning limit.",
            "Report the accumulated event dose to the flight surgeon."
        ]),
        new(nameof(HabitatMetric.CarbonDioxide), "High cabin CO₂", SpaceHazard.HostileClosedEnvironments, "Hypoxia",
        [
            "Verify the CO₂ removal system (scrubber) is running; switch to the backup unit.",
            "Increase cabin air circulation between modules.",
            "Reduce physical activity aboard until CO₂ falls.",
            "Watch crew for headache, fatigue or faster breathing."
        ]),
        new(nameof(HabitatMetric.Oxygen), "Abnormal cabin oxygen", SpaceHazard.HostileClosedEnvironments, "Hypoxia",
        [
            "Cross-check with a portable oxygen sensor.",
            "If low: check the oxygen generation system and prepare emergency masks.",
            "If high: remove ignition sources; elevated oxygen increases fire risk.",
            "Notify mission control with the sensor history."
        ]),
        new(nameof(HabitatMetric.CabinPressure), "Cabin pressure off nominal", SpaceHazard.HostileClosedEnvironments, "Decompression sickness",
        [
            "Check for a leak: close hatches to isolate modules one by one.",
            "Move crew towards the return vehicle if pressure keeps dropping.",
            "Prepare suits and emergency masks.",
            "Notify mission control immediately."
        ]),
        new(nameof(HabitatMetric.CabinTemperature), "Cabin temperature off nominal", SpaceHazard.HostileClosedEnvironments, "Inadequate systems operations support",
        [
            "Check the thermal control system and coolant loop status.",
            "Adjust module setpoints and crew clothing.",
            "Watch crew for heat stress or cold exposure."
        ]),
        new(nameof(HabitatMetric.Humidity), "Cabin humidity off nominal", SpaceHazard.HostileClosedEnvironments, "Host-microorganism interactions",
        [
            "Check the condensate and humidity control system.",
            "Inspect surfaces for condensation; high humidity promotes microbial growth.",
            "Adjust air flow and temperature setpoints."
        ]),
        new(nameof(HabitatMetric.RadiationDoseRate), "Solar particle event", SpaceHazard.SpaceRadiation, "Radiation-induced cancer",
        [
            "Move all crew to the designated storm shelter.",
            "Postpone or terminate any spacewalk.",
            "Keep personal dosimeters on and log the start time.",
            "Stay sheltered until the dose rate returns below the warning limit."
        ]),
        new("SleepDebt", "Sleep debt", SpaceHazard.IsolationAndConfinement, "Inadequate sleep and irregular schedules",
        [
            "Protect the next sleep period: no tasks scheduled in the last hour before it.",
            "Use the habitat's lighting schedule to support the body clock.",
            "Move safety-critical tasks away from the crew member's low-alertness periods.",
            "Discuss with the flight surgeon if the debt lasts more than three nights."
        ]),
        new("BehavioralHealth", "Low mood or high stress", SpaceHazard.IsolationAndConfinement, "Behavioral changes and psychiatric disorders",
        [
            "Schedule a private conference with the flight psychologist.",
            "Review the workload and rebalance tasks across the crew.",
            "Protect personal time and contact with family.",
            "Follow up with another check-in within 24 hours."
        ])
    ];

    public static PlaybookEntry? For(string key) => Entries.FirstOrDefault(e => e.Key == key);
}
