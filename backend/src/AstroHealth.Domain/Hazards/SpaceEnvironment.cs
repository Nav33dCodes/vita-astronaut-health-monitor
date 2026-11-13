using AstroHealth.Domain.Missions;

namespace AstroHealth.Domain.Hazards;

/// <summary>
/// The five hazards of human spaceflight identified by NASA's Human Research Program (HRP).
/// See https://www.nasa.gov/hrp/hazards/.
/// </summary>
public enum SpaceHazard
{
    SpaceRadiation,
    IsolationAndConfinement,
    DistanceFromEarth,
    GravityFields,
    HostileClosedEnvironments
}

/// <summary>
/// Reference values for the space environment by destination. Figures are approximate, taken
/// from published measurements, and used for simulation and context, not for clinical decisions.
/// </summary>
public static class SpaceEnvironment
{
    /// <summary>
    /// NASA's career effective dose limit for astronauts (NASA-STD-3001 Volume 1, Rev B, 2022).
    /// </summary>
    public const decimal CareerDoseLimitMsv = 600m;

    /// <summary>
    /// Typical background (galactic cosmic ray) dose rate in mSv/day:
    /// ISS roughly 0.5; lunar surface about 1.37 (Chang'e 4 LND, 2020);
    /// deep-space cruise about 1.84 (Curiosity RAD during Mars transit, 2013).
    /// </summary>
    public static decimal BaselineDoseRateMsvPerDay(MissionDestination destination) => destination switch
    {
        MissionDestination.LowEarthOrbit => 0.5m,
        MissionDestination.Lunar => 1.37m,
        MissionDestination.Mars => 1.84m,
        MissionDestination.DeepSpace => 1.84m,
        _ => 0.5m
    };

    /// <summary>
    /// One-way signal delay between the crew and Earth, in seconds (min, max). Mars varies with
    /// the planets' relative positions, roughly 3 to 22 minutes.
    /// </summary>
    public static (double MinSeconds, double MaxSeconds) OneWayLightTime(MissionDestination destination) => destination switch
    {
        MissionDestination.LowEarthOrbit => (0, 0),
        MissionDestination.Lunar => (1.3, 1.3),
        MissionDestination.Mars => (3 * 60, 22 * 60),
        MissionDestination.DeepSpace => (22 * 60, 22 * 60),
        _ => (0, 0)
    };

    /// <summary>
    /// How independent of Earth the crew must be. With a multi-minute delay a medical emergency
    /// cannot wait for a round trip, so onboard decision support matters more.
    /// </summary>
    public static AutonomyLevel Autonomy(MissionDestination destination) => destination switch
    {
        MissionDestination.LowEarthOrbit => AutonomyLevel.EarthSupported,
        MissionDestination.Lunar => AutonomyLevel.EarthSupported,
        MissionDestination.Mars => AutonomyLevel.EarthIndependent,
        MissionDestination.DeepSpace => AutonomyLevel.EarthIndependent,
        _ => AutonomyLevel.EarthSupported
    };
}

public enum AutonomyLevel
{
    /// <summary>Real-time support from the ground is available (seconds of delay at most).</summary>
    EarthSupported,

    /// <summary>Minutes of delay: the crew must act on its own and inform the ground afterwards.</summary>
    EarthIndependent
}
